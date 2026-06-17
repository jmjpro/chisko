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

## Step 2 — Grill

Invoke `/grill-with-docs <original-arg>`. The issue title and body are already in context from Step 1 — use them to inform the grilling session.

Run the full grilling session: sharpen terminology, stress-test edge cases, update CONTEXT.md and ADRs as decisions crystallise.

When the grilling session concludes (all domain decisions captured and documented), proceed to Step 3.

## Step 3 — Advance label

Ask: `Grilling complete. Advance label needs-info → ready-for-agent? [y/n]`

If yes, call `save_issue` **once** with `labels` set to the issue's current labels (from Step 1) with `needs-info` removed and `ready-for-agent` added.
