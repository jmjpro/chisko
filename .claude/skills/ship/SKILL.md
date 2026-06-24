---
name: ship
description: Open a PR for the current branch, skip the Vercel check for docs/tooling-only changes, otherwise poll it and diff its build log against main for newly introduced warnings/errors, ask for merge confirmation, merge, then clean up the worktree and sync main. Composable — used standalone or invoked from /cpr.
argument-hint: "[optional issue-id-or-number]"
---

Open a PR for the current branch, wait for the Vercel preview-build check (unless the PR is docs/tooling-only), confirm with the user before merging, then clean up the worktree (if any) and sync the main checkout.

## Step 1 — Open PR

Run `gh pr create --base main --fill`. If the calling skill already has a title/`Closes CHI-N` trailer in context (e.g. from `/commit`), reuse that for the title/body instead of `--fill`. If invoked standalone, derive title/body from the latest commit (`git log -1 --pretty=%B`).

Capture the PR URL and number from the output.

## Step 2 — Determine whether to skip the build check

Run `gh pr diff <PR-number> --name-only` to list changed files.

If every changed file's path starts with `.claude/` or `docs/` — tooling/documentation only, no app code — the Vercel build can't meaningfully validate this PR. Skip Steps 3 and 4 (poll + log diff) entirely and go straight to Step 5 with a "skipped" result.

Otherwise, proceed to Step 3 as normal.

## Step 3 — Poll the Vercel preview-build check

`gh pr view <PR-number> --json statusCheckRollup` returns two entries per PR (confirmed against recently merged PRs, where `reviewDecision` is always empty — there's no required-reviewer branch protection here):

- a `StatusContext` with `context: "Vercel"` and a `state` field (`SUCCESS`/`PENDING`/`FAILURE`) — this is the actual preview-build check, with `targetUrl` pointing at the Vercel deployment.
- a `CheckRun` named `"Vercel Preview Comments"` — just the bot that posts the preview-URL comment on the PR. Ignore this one; it is not a build gate.

Poll `gh pr view <PR-number> --json statusCheckRollup` every ~15-20s, up to a ~10 minute timeout, reading only the `context: "Vercel"` entry's `state`.

- `state: "SUCCESS"` within the timeout → result is "passed".
- `state: "FAILURE"` (or similar terminal failure state) → capture its `targetUrl`, then check whether it's the Convex-cloud kill switch (below) before treating it as a real failure.
- Still `PENDING` after the timeout → stop polling, tell the user it's taking longer than expected, treat result as "pending".

### Detect the `ENABLE_CONVEX_CLOUD=false` kill switch

`ENABLE_CONVEX_CLOUD` is a Sensitive Vercel env var (Preview scope) — its value can never be read back via `vercel env ls`/`pull` or the API, only consumed at build time. `vercel.json`'s `buildCommand` deliberately runs `exit 1` when it's `"false"`, after echoing `"ENABLE_CONVEX_CLOUD=false — refusing to deploy a new Convex preview backend"`. That makes the build check fail by design, not because of anything in the PR.

So whenever Step 3 yields `FAILURE`, fetch that deployment's build log with `mcp__plugin_vercel_vercel__get_deployment_build_logs` (idOrUrl: the current PR's deployment ID, teamId from `list_teams`) and check for that sentinel line (case-insensitive match on `ENABLE_CONVEX_CLOUD=false` or `refusing to deploy a new Convex preview backend`).

- Sentinel found → result is "skipped (convex cloud disabled)". Skip Step 4 entirely (there's no real build to diff). Go to Step 5.
- Sentinel not found → it's a genuine failure. Result is "failed". Proceed to Step 4 as normal (the log-diff subagent's summary is still useful context for a real failure).

## Step 4 — Diff the build log against main for newly introduced warnings/errors

A `SUCCESS` build can still emit new warnings (or non-fatal errors) worth catching before merge. Raw build logs run 1,000+ lines / tens of thousands of characters per deployment — far too large to fetch or paste directly into this conversation. Delegate the fetch-and-diff to a subagent so only a short summary returns.

1. Get the current PR's deployment: extract the deployment ID/URL from Step 2's `targetUrl` (the `context: "Vercel"` check entry).
2. Get the baseline deployment: call `list_deployments` (project ID from `.vercel/project.json`'s `projectId`, team ID from `orgId` or the `list_teams` MCP tool) and take the first entry with `target: "production"` — that's main's current HEAD build, returned newest-first.
3. Spawn an Agent (`subagent_type: general-purpose`) with a self-contained prompt, filling in the actual IDs:

   > Compare Vercel build logs between two deployments to find NEW warnings/errors introduced by deployment `<current-id>` that are not present in baseline deployment `<baseline-id>`. Use the `mcp__plugin_vercel_vercel__get_deployment_build_logs` tool (teamId: `<teamId>`) to fetch each log (idOrUrl: `<current-id>`, then idOrUrl: `<baseline-id>`). From each, extract lines that look like build warnings or errors (case-insensitive: "warning", "error", "npm warn", "Failed to compile", deprecation notices, etc). Normalize away timestamps/hashes/line numbers so cosmetic differences don't count as "new". Report ONLY: (1) a count of new warning lines and new error lines, (2) the verbatim text of each new line (cap at 20), (3) "No new warnings or errors" if none. Keep the report under 300 words — do not return the raw logs.

4. Use the subagent's summary in Step 5 below. Do not fetch or paste raw build logs into the main conversation yourself.

## Step 5 — Ask for merge confirmation

Combine the build-check skip status (Step 2), check result (Step 3), and log diff (Step 4):

- **Skipped (docs/tooling-only)**: `PR opened at <url>. Changes are tooling/docs-only (.claude/, docs/) — skipping the Vercel check. Merge it? [y/n]`
- **Skipped (convex cloud disabled)**: `PR opened at <url>. Vercel build failed by design — ENABLE_CONVEX_CLOUD=false is refusing to deploy a new Convex preview backend, unrelated to this PR's content. Skipping the build check. Merge it? [y/n]`
- **Passed, no new warnings/errors**: `PR opened at <url>. Vercel check passed, no new build warnings/errors. Merge it? [y/n]`
- **Passed, but new warnings/errors found**: show the subagent's summary, then `Vercel check passed but the build log has <N> new warning(s)/error(s) not present in main (<deployment-url>):\n<summary>\nMerge anyway? [y/n]`
- **Failed**: show the failure summary and its URL (plus the log-diff summary if it found anything beyond the failure itself), then `Vercel preview build FAILED (<url>). Merge anyway? [y/n]` — never silently refuse, same override pattern as `/push`'s hook-failure prompt.
- **Pending/timed out**: `Vercel check still pending after 10 minutes (<url>). Merge anyway? [y/n]`

If no, stop. Leave the PR open and the worktree (if any) intact.

## Step 6 — Merge

Run `gh pr merge --squash` — **without** `--delete-branch`. That flag also tries to switch the local repo to the base branch (`main`) and delete the local branch, which fails with `fatal: 'main' is already used by worktree at '<path>'` whenever this runs from a linked worktree (the common case, since `/jgwd` always sets one up) — `main` is already checked out in the main checkout. Branch deletion happens explicitly in Steps 8-9 instead. Squash keeps one commit per PR on `main`, matching this repo's existing history.

## Step 7 — Verify the merge landed

Run `gh pr view --json state` and confirm it reports `MERGED` — don't trust the merge command's exit code alone (a `git: fatal` error from a stray `--delete-branch` can mask a merge that actually succeeded). If it doesn't show `MERGED`, stop and report the actual state before doing anything destructive to the worktree.

## Step 8 — Delete the remote branch

Run `git push origin --delete <branch>`. (Not handled by Step 6's merge command — see the note there.)

## Step 9 — Detect whether this ran inside a linked worktree, then clean up

Run `git worktree list --porcelain` and take the first `worktree` entry (the main checkout's path). Compare it to `git rev-parse --show-toplevel`.

- Match → running in the main checkout already; skip cleanup, go to Step 10.
- Differ → this is a linked worktree; clean it up:
  1. `cd` back to the main checkout path.
  2. `git worktree remove <worktree-path>`
  3. `git branch -D <branch>` — force delete; a squash-merge never shows as merged to git locally, but Step 7 already confirmed the PR merged on GitHub.

## Step 10 — Sync main checkout

In the main checkout, run `git pull` on `main` so it's immediately up to date for the next `/jgwd`.

## Notes

- Never merge without the confirmation in Step 5, regardless of check outcome.
- `/cpr` invokes this after `/push` and before closing the Linear issue.
