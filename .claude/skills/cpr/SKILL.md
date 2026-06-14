---
name: cpr
description: Commit, Push, and Resolve — confirms issue is In Progress + ready-for-human, runs /commit then /push, then offers to mark the issue Done and strip triage labels.
argument-hint: "<issue-number> [optional commit message hint]"
---

The first argument is the issue number. Any additional text is an optional commit message hint. Extract the issue number before the pre-condition check.

## Step 0 — Pre-condition check

Fetch board state and issue details in parallel:

```bash
gh project item-list 2 --owner jmjpro --format json
gh issue view <N> --repo jmjpro/chisko --json number,title,labels
```

**Required state:** board Status = `In Progress` AND label `ready-for-human` is present.

If both conditions are met, skip to Step 1.

Otherwise, print a single summary line:
> Issue #N "<title>" — status: <status or "not on board">, labels: <labels or "none">

Then ask: `Set to In Progress + ready-for-human and continue? [y/n]`

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

4. **Add ready-for-human label** (if not already present):
   ```bash
   gh issue edit <N> --repo jmjpro/chisko --add-label "ready-for-human"
   ```

## Step 1 — Commit

Invoke `/commit <issue-number> <optional hint>` — stages files and creates a conventional commit with a `Closes #N` trailer.

## Step 2 — Push

Invoke `/push` — pushes to origin; handles hook failures interactively before continuing.

GitHub auto-closes the issue when the commit with the `Closes #N` trailer is pushed. Stop if any step fails and report what happened before proceeding.

## Step 3 — Close

Ask: `Ship complete. Move issue #N to Done and remove triage labels? [y/n]`

If yes:

1. Set status to Done:
   ```bash
   gh project item-edit --id <ITEM_NODE_ID> \
     --project-id PVT_kwHOADGxjc4BaYiT \
     --field-id PVTSSF_lAHOADGxjc4BaYiTzhVQimQ \
     --single-select-option-id 98236657
   ```

2. Remove any triage labels currently on the issue (check which are present from Step 0 and remove only those):
   ```bash
   gh issue edit <N> --repo jmjpro/chisko \
     --remove-label "needs-triage" \
     --remove-label "needs-info" \
     --remove-label "ready-for-agent" \
     --remove-label "ready-for-human" \
     --remove-label "wontfix"
   ```

---

**Board reference (project #2, owner jmjpro):**
- Project node ID: `PVT_kwHOADGxjc4BaYiT`
- Status field ID: `PVTSSF_lAHOADGxjc4BaYiTzhVQimQ`
- Status option IDs: Todo `f75ad846` · In Progress `47fc9ee4` · Done `98236657`
