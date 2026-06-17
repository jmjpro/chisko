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

If yes, call `save_issue` **once** with `state: "In Progress"` and `labels` set to the issue's current labels (from Step 1) plus `ready-for-agent`. `save_issue` resolves state and label names directly — do not call `list_issue_statuses`/`list_issue_labels` to look up IDs first.

## Step 2 — TDD

Invoke `/tdd`. The issue title and body are already in context from Step 1 — use them to drive the TDD session.

Run the full red-green-refactor loop per the tdd skill instructions. When all tests pass and refactoring is complete, proceed to Step 3.

## Step 3 — Advance label

Ask: `TDD complete. Advance label ready-for-agent → ready-for-human? [y/n]`

If yes, call `save_issue` **once** with `labels` set to the issue's current labels (from Step 1) with `ready-for-agent` removed and `ready-for-human` added.
