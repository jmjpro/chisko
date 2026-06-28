# Renovate dependency update strategy

We use Renovate (over Dependabot) with a weekly Sunday schedule. Patch updates and devDependency minor updates auto-merge after green CI; production dependency minors and all major bumps require manual review. devDependency updates are batched into a single grouped PR per week to keep the queue quiet.

## Convex packages are excluded from auto-merge

`convex`, `convex-test`, and `@convex-dev/*` are pinned to manual review even for patches. Convex updates can require regenerating `convex/_generated/` or adjusting to API changes; a failed auto-merge would break the backend silently.

## `npm run build` is not part of GitHub Actions CI

GitHub Actions runs `typecheck`, `lint`, `test`, and `npm audit --audit-level=high`. It does not run `npm run build`. The Vercel preview deployment already runs the full build (including `convex deploy`) on every PR, making a second build step in CI redundant. Running it in both places doubles build time for no new signal.
