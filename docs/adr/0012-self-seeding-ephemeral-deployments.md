# Brand-new Convex deployments self-seed at build time, guarded to run once

Per ADR 0011, every PR gets a brand-new, empty Convex deployment, and production itself started from an empty deployment too. Nothing previously populated catalog data (suppliers, IEC rates, plans) or the smart-meter registry / israelPlaces tables on a fresh deployment, so a new deployment's prerendered pages would query empty tables. We extend `vercel.json`'s `buildCommand` to run a seed step between the two `npx convex deploy` calls — after functions/schema are pushed, before `astro build` queries them — so a fresh deployment is fully usable with no manual step.

The seed step also triggers the existing `smartMeterRegistryRefresh.doRefresh` and `israelPlacesRefresh.doRefresh` actions (previously only run by the weekly cron), since those tables need data immediately too, not a week later. All three steps (catalog seed, smart-meter refresh, israelPlaces refresh) are orchestrated by a single `internal/seedAll:runAll` internal action.

Both the catalog seed and the refresh triggers are guarded to skip if their tables are already populated. The `buildCommand` runs on every push, not just deployment creation — without the guard, every push to an existing PR (or every production deploy) would re-fetch and re-insert tens of thousands of rows from external IEC/data.gov.il sources, which is slow and risks hitting their rate limits. The guard means only the first build of a brand-new deployment pays that cost; subsequent pushes to the same deployment skip it and rely on the weekly cron to keep registry data fresh.

## The seed step can't call the internal action directly

The first implementation had `buildCommand` invoke `npx convex run internal/seedAll:runAll` directly. This fails in CI with `You do not have permission to perform this operation (RunInternalActions)`: that permission (`deployment:functions:runInternalActions`) is only granted to logged-in user roles (Team Admin, Team Developer on non-prod, Project Admin) — it does not apply to deploy keys at all, which are service tokens with their own fixed capabilities (deploy code), independent of any role. There's no deploy-key variant, prod or preview, that can run an internal function via the CLI.

Instead, `convex/http.ts` exposes a `POST /seed` HTTP action that calls `internal.internal.seedAll.runAll` from inside the deployment (HTTP actions run with full internal access regardless of how the request was authenticated — the deploy-key restriction doesn't apply once code is executing inside Convex). The route is gated by comparing an `Authorization: Bearer <SEED_SECRET>` header against the `SEED_SECRET` environment variable, since an HTTP route is otherwise open to the public internet. `buildCommand` calls it with `curl` instead of `convex run`:

```
npx convex deploy
  && curl -fsS -X POST "${VITE_CONVEX_URL/.convex.cloud/.convex.site}/seed" -H "Authorization: Bearer $SEED_SECRET"
  && npx convex deploy --cmd 'npm run build'
```

`SEED_SECRET` must hold the same value on both sides of that `curl` call: Vercel needs it (to send the header) and Convex needs it (to check the header). It's set directly on the two deployments that already exist (`npx convex env set SEED_SECRET '<value>' --prod` for production, the MCP `envSet` tool for the dev deployment) and on all three Vercel environments (`npx vercel env add SEED_SECRET <env> --value '<value>' --yes`). Per-PR preview deployments don't exist yet when those commands run, so a one-time `npx convex env default set SEED_SECRET '<value>' --type preview` sets it as a **project-level default** — every newly created preview deployment picks it up automatically, no manual step needed when a PR opens.

## Considered Options

- **HTTP action gated by a shared secret, called via `curl` (chosen)**: works with deploy keys, since the restricted operation (running an internal action) happens inside the deployment rather than over the CLI's admin API. Needs a secret kept in sync across deployments/environments, mitigated by Convex's preview-deployment env var defaults.
- **`npx convex run internal/seedAll:runAll` in `buildCommand` (original attempt)**: rejected — fails everywhere `CONVEX_DEPLOY_KEY` is used (i.e. every CI build) because deploy keys cannot be granted the `runInternalActions` permission.
- **Make `seedAll.runAll` a public action**: deploy keys can invoke public functions via `convex run`, so this would have worked without a secret. Rejected — it permanently exposes a seed/refresh trigger on the public API surface with no authentication, for the sake of avoiding one shared secret.
- **Manual seeding**: someone runs the seed function by hand after creating a deployment. Rejected — easy to forget, and per ADR 0011 deployments are created automatically on every PR push, so a manual step doesn't scale.
- **Always re-trigger refresh on every build**: simplest code, no guard logic. Rejected — re-fetching the full IEC CSV and data.gov.il dataset on every push is wasteful and risks external rate limits for no benefit, since the weekly cron already keeps the data current.

The /seed/*.json files (a stale, hand-drifted attempt at externalizing this data — 19 plans vs. the 21 already hardcoded in `seed.ts`) are removed; `seed.ts`'s inline literals are the source of truth.
