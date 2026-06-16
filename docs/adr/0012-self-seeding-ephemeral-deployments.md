# Brand-new Convex deployments self-seed at build time, guarded to run once

Per ADR 0011, every PR gets a brand-new, empty Convex deployment, and production itself started from an empty deployment too. Nothing previously populated catalog data (suppliers, IEC rates, plans) or the smart-meter registry / israelPlaces tables on a fresh deployment, so a new deployment's prerendered pages would query empty tables. We extend `vercel.json`'s `buildCommand` to run a seed step between the two `npx convex deploy` calls — after functions/schema are pushed, before `astro build` queries them — so a fresh deployment is fully usable with no manual step.

The seed step also triggers the existing `smartMeterRegistryRefresh.doRefresh` and `israelPlacesRefresh.doRefresh` actions (previously only run by the weekly cron), since those tables need data immediately too, not a week later.

Both the catalog seed and the refresh triggers are guarded to skip if their tables are already populated. The `buildCommand` runs on every push, not just deployment creation — without the guard, every push to an existing PR (or every production deploy) would re-fetch and re-insert tens of thousands of rows from external IEC/data.gov.il sources, which is slow and risks hitting their rate limits. The guard means only the first build of a brand-new deployment pays that cost; subsequent pushes to the same deployment skip it and rely on the weekly cron to keep registry data fresh.

## Considered Options

- **Build-time auto-seed with guard (chosen)**: zero manual steps for a new deployment, bounded cost on repeat builds.
- **Manual seeding**: someone runs `npx convex run seed:run` after creating a deployment. Rejected — easy to forget, and per ADR 0011 deployments are created automatically on every PR push, so a manual step doesn't scale.
- **Always re-trigger refresh on every build**: simplest code, no guard logic. Rejected — re-fetching the full IEC CSV and data.gov.il dataset on every push is wasteful and risks external rate limits for no benefit, since the weekly cron already keeps the data current.

The /seed/*.json files (a stale, hand-drifted attempt at externalizing this data — 19 plans vs. the 21 already hardcoded in `seed.ts`) are removed; `seed.ts`'s inline literals are the source of truth.
