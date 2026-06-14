---
name: jtdd
description: Joshua's TDD wrapper. Confirms issue is In Progress + ready-for-agent in Linear, runs the TDD session, then offers to advance label to ready-for-human.
argument-hint: "<issue-id-or-number>"
---

Accept one argument: a Linear issue ID (`CHI-18`) or a bare number (`18`). Normalize to `CHI-N` format.

## Step 1 — Pre-condition check

Use the `linear-server` MCP tools to fetch the issue. Get its current workflow state (e.g. "In Progress") and its labels (e.g. `ready-for-agent`).

**Required state:** workflow state = `In Progress` AND label `ready-for-agent` is present.

If both conditions are met, skip to Step 2.

Otherwise, print a single summary line:
> CHI-N "<title>" — state: <state or "none">, labels: <labels or "none">

Then ask: `Set to In Progress + ready-for-agent and continue? [y/n]`

If no, stop.

If yes, use the `linear-server` MCP tools to apply both changes in parallel:
1. Update the issue's workflow state to `In Progress` (look up the state ID if needed via the team's workflow states).
2. Add the label `ready-for-agent` to the issue (look up the label ID if needed via the team's labels).

## Step 2 — TDD

Invoke `/tdd`. The issue title and body are already in context from Step 1 — use them to drive the TDD session.

Run the full red-green-refactor loop per the tdd skill instructions. When all tests pass and refactoring is complete, proceed to Step 3.

## Step 3 — Advance label

Ask: `TDD complete. Advance label ready-for-agent → ready-for-human? [y/n]`

If yes, use the `linear-server` MCP tools to:
1. Remove the label `ready-for-agent` from the issue.
2. Add the label `ready-for-human` to the issue.
