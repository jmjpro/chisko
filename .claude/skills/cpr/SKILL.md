---
name: cpr
description: Commit, Push, and Resolve — confirms issue is In Progress + ready-for-human in Linear, runs /commit then /push, then offers to mark the issue Done and strip triage labels.
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

If yes, use the `linear-server` MCP tools to apply both changes in parallel:
1. Update the issue's workflow state to `In Progress` (look up the state ID if needed via the team's workflow states).
2. Add the label `ready-for-human` to the issue (look up the label ID if needed via the team's labels).

## Step 1 — Commit

Invoke `/commit CHI-N <optional hint>` — stages files and creates a conventional commit with a `Closes CHI-N` trailer (no `#` prefix).

## Step 2 — Push

Invoke `/push` — pushes to origin; handles hook failures interactively before continuing.

Stop if any step fails and report what happened before proceeding.

## Step 3 — Close

Ask: `Ship complete. Move CHI-N to Done and remove triage labels? [y/n]`

If yes, use the `linear-server` MCP tools to:

1. Update the issue's workflow state to `Done` (look up the state ID if needed via the team's workflow states).

2. Remove all triage labels currently present on the issue. Check which of these are actually present (from Step 0 data) and remove only those:
   - `needs-triage`
   - `needs-info`
   - `ready-for-agent`
   - `ready-for-human`
   - `wontfix`
