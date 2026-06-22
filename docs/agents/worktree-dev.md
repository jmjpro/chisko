# Worktree Dev Setup

`npm run setup:worktree -- <port>` prepares a new git worktree to run the dev
server. It always copies `.env.local` from another worktree (this repo's
Convex credentials are gitignored) and sets `PORT` to the value you pass.

## Shared deployment (default)

By default, the new worktree points at the same Convex deployment every other
worktree uses. Only one worktree should run `npm run dev` at a time — that's
the one whose `convex dev` owns pushing functions and watching for changes.
Every other worktree runs `npm run dev:client-only` (just `astro dev`) against
that same backend.

## Dedicated deployment (`--own-deployment`)

`npm run setup:worktree -- <port> --own-deployment` instead provisions a
separate local Convex deployment for the new worktree: its own
`convex-local-backend` process, its own ports (derived from `<port>`, see
`convexPortsFor` in `scripts/setupWorktree.ts`), and its own `.convex/local`
data directory. This worktree can run the full `npm run dev` independently of
any other worktree — no "only one owns convex dev" constraint.

By default the new deployment starts empty. Pass `--clone` to clone data from
the worktree whose `.env.local` was copied instead (override the source with
`--clone-from <path>`). Cloning requires the source worktree's backend to
already be running (`npm run dev` started there), since it exports over that
backend's local HTTP port.

Cloning is opt-in rather than the default because, measured against this
repo's actual data, a full clone takes **~9-10 minutes** — dominated by the
`smartMeterAddresses` table, which is disproportionately slow to export given
how little JSON it actually holds (see CHI-72, the same table's storage-bloat
issue). It's not a hang, just a real per-setup cost, so reach for `--clone`
only when a worktree actually needs production-like data.

Trade-off: each dedicated deployment duplicates the local SQLite + file
storage on disk (several hundred MB if cloned).

## Tearing down a worktree

Before `git worktree remove`-ing a worktree that used `--own-deployment`, run
`npm run teardown:worktree` from inside it first — it kills that worktree's
`convex-local-backend` process and deletes its `.convex` dir. (For
shared-deployment worktrees there's nothing to tear down; they never had a
local `.convex` dir of their own.)

The deployment name itself (`local-<user>-<project>-<n>`) stays registered in
your Convex account as unused metadata — harmless since local deployments
don't consume cloud quota, but there's no CLI command to deregister it.
