---
name: jgwd
description: Joshua's grill-with-docs wrapper. Confirms issue is In Progress + needs-info in Linear, runs the grilling session, then offers to advance label to ready-for-agent.
argument-hint: "<issue-id-or-number>"
---

Accept one argument: a Linear issue ID (`CHI-18`) or a bare number (`18`). Normalize to `CHI-N` format.

## Step 1 — Pre-condition check

Use the `linear-server` MCP tools to fetch the issue. Get its current workflow state (e.g. "In Progress") and its labels (e.g. `needs-info`, `ready-for-agent`).

**Required state:** workflow state = `In Progress` AND label `needs-info` is present.

If both conditions are met, skip to Step 2.

Otherwise, print a single summary line:
> CHI-N "<title>" — state: <state or "none">, labels: <labels or "none">

Then ask: `Set to In Progress + needs-info and continue? [y/n]`

If no, stop.

If yes, call `save_issue` **once** with `state: "In Progress"` and `labels` set to the issue's current labels (from Step 1) plus `needs-info`. `save_issue` resolves state and label names directly — do not call `list_issue_statuses`/`list_issue_labels` to look up IDs first.

## Step 2 — Worktree confirmation

Determine the main worktree's path: run `git worktree list --porcelain` and take the first `worktree ` entry (the main checkout, never a linked worktree). All paths in this step are relative to that path, regardless of the cwd the skill was invoked from — this avoids nesting a new worktree inside an already-linked one.

Pick a slug: a short (3-6 word) kebab-case judgment-call summary of the issue title (e.g. "enable-iec-smart-meter-retrieval"). The target path is `<main-worktree-path>/.claude/worktrees/chi-N-<slug>`.

Check whether a worktree already exists for this issue: look for an entry in `git worktree list` whose branch matches the issue's `gitBranchName` (from Step 1's `get_issue` call). If one exists, skip the rest of this step — `cd` into it and proceed to Step 3.

Otherwise ask: `Create a new worktree for CHI-N at .claude/worktrees/chi-N-<slug>? [y/n]`

If no, continue in the current directory and proceed to Step 3.

If yes, run in order:
1. `git worktree add <main-worktree-path>/.claude/worktrees/chi-N-<slug> -b <gitBranchName>`
2. `cd` into that path — keep subsequent Bash calls in this directory for the rest of the flow (Read/Edit/Write still need absolute paths; only Bash's cwd carries over).
3. `npm install`
4. Pick a port: scan other worktrees' `.env.local` for `PORT=` values and currently-listening ports, starting from 4322 (one above Astro's own default of 4321, which the main checkout implicitly uses), and take the first free one.
5. `npm run setup:worktree -- <port>`
6. `vercel link --project chisko` — never run a bare `vercel pull`/`vercel link` (no `--project`), since it auto-detects the project by directory name and will silently create a new standalone Vercel project named after the worktree directory if no exact match exists.

Do not use the `EnterWorktree` tool for this — it can't target this exact path/branch combination and doesn't know about steps 3-6 above.

## Step 3 — Grill

Invoke `/grill-with-docs <original-arg>`. The issue title and body are already in context from Step 1 — use them to inform the grilling session.

Run the full grilling session: sharpen terminology, stress-test edge cases, update CONTEXT.md and ADRs as decisions crystallise.

When the grilling session concludes (all domain decisions captured and documented), proceed to Step 4.

## Step 4 — Advance label

Ask: `Grilling complete. Advance label needs-info → ready-for-agent? [y/n]`

If yes, call `save_issue` **once** with `labels` set to the issue's current labels (from Step 1) with `needs-info` removed and `ready-for-agent` added.
