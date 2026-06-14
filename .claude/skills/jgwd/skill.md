---
name: jgwd
description: Joshua's grill-with-docs wrapper. Confirms issue is In Progress + needs-info on the project board, runs the grilling session, then offers to advance label to ready-for-agent.
argument-hint: "<issue-number-or-url>"
---

Accept one argument: an issue number (`18`) or a full GitHub URL (`https://github.com/jmjpro/chisko/issues/18`). Extract the issue number either way.

## Step 1 — Pre-condition check

Fetch board state and issue details in parallel:

```bash
gh project item-list 2 --owner jmjpro --format json
gh issue view <N> --repo jmjpro/chisko --json number,title,body,labels
```

**Required state:** board Status = `In Progress` AND label `needs-info` is present.

If both conditions are met, skip to Step 2.

Otherwise, print a single summary line:
> Issue #N "<title>" — status: <status or "not on board">, labels: <labels or "none">

Then ask: `Set to In Progress + needs-info and continue? [y/n]`

If no, stop.

If yes, apply the changes:

1. **If not on board** — add the item and capture its node ID from the returned JSON:
   ```bash
   gh project item-add 2 --owner jmjpro --url https://github.com/jmjpro/chisko/issues/<N> --format json
   ```

2. **If already on board** — the item node ID is the `id` field from `item-list`.

3. **Set status to In Progress:**
   ```bash
   gh project item-edit --id <ITEM_NODE_ID> \
     --project-id PVT_kwHOADGxjc4BaYiT \
     --field-id PVTSSF_lAHOADGxjc4BaYiTzhVQimQ \
     --single-select-option-id 47fc9ee4
   ```

4. **Add needs-info label** (if not already present):
   ```bash
   gh issue edit <N> --repo jmjpro/chisko --add-label "needs-info"
   ```

## Step 2 — Grill

Invoke `/grill-with-docs <original-arg>`. Run the full grilling session: sharpen terminology, stress-test edge cases, update CONTEXT.md and ADRs as decisions crystallise.

When the grilling session concludes (all domain decisions captured and documented), proceed to Step 3.

## Step 3 — Advance label

Ask: `Grilling complete. Advance label needs-info → ready-for-agent? [y/n]`

If yes:
```bash
gh issue edit <N> --repo jmjpro/chisko --remove-label "needs-info" --add-label "ready-for-agent"
```

---

**Board reference (project #2, owner jmjpro):**
- Project node ID: `PVT_kwHOADGxjc4BaYiT`
- Status field ID: `PVTSSF_lAHOADGxjc4BaYiTzhVQimQ`
- Status option IDs: Todo `f75ad846` · In Progress `47fc9ee4` · Done `98236657`
