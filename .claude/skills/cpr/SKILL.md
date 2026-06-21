---
name: cpr
description: Commit, Push, and Resolve — confirms issue is In Progress + ready-for-human in Linear, runs /commit then /push, then /ship to open the PR and wait for a confirmed merge, then offers to mark the issue Done and strip triage labels.
argument-hint: "<issue-id-or-number> [optional commit message hint]"
---

The first argument is the issue ID (`CHI-18`) or a bare number (`18`). Normalize to `CHI-N` format. Any additional text is an optional commit message hint.

## Step 0 — Pre-condition check

Use the `linear-server` MCP tools to fetch the issue. Get its current workflow state and labels.

**Required state:** workflow state = `In Progress` AND label `ready-for-human` is present.

If both conditions are met, skip to Step 1.

Otherwise, print a single summary line:
> CHI-N "<title>" — state: <state or "none">, labels: <labels or "none">

Then ask: `Set to In Progress + ready-for-human and continue? [y/n]`

If no, stop.

If yes, call `save_issue` **once** with `state: "In Progress"` and `labels` set to the issue's current labels (from Step 0) plus `ready-for-human`. `save_issue` resolves state and label names directly — do not call `list_issue_statuses`/`list_issue_labels` to look up IDs first.

## Step 1 — Commit

Invoke `/commit CHI-N <optional hint>` — stages files and creates a conventional commit with a `Closes CHI-N` trailer (no `#` prefix).

## Step 2 — Push

Invoke `/push` — pushes to origin; handles hook failures interactively before continuing.

Stop if any step fails and report what happened before proceeding.

## Step 3 — Ship

Invoke `/ship CHI-N` — opens the PR, polls the Vercel preview-build check, asks for merge confirmation, merges, and cleans up the worktree (if any).

If the user declines the merge confirmation inside `/ship`, stop here — do not proceed to Step 4. The PR stays open and the issue stays in its current state.

## Step 4 — Close

Re-fetch the issue. If a `Closes CHI-N`/`Fixes CHI-N` trailer already auto-closed it via the Linear GitHub integration (state is already `Done`), report that it's already Done and skip the `save_issue` call below (same convention as the `resolve` skill).

Otherwise ask: `Ship complete. Move CHI-N to Done and remove triage labels? [y/n]`

If yes, call `save_issue` **once** with `state: "Done"` and `labels` set to the issue's current labels (from Step 0) minus any of these triage labels that are present:
   - `needs-triage`
   - `needs-info`
   - `ready-for-agent`
   - `ready-for-human`
   - `wontfix`
