---
name: resolve
description: Close a Linear issue and confirm it is marked as Done. Uses the linear-server MCP.
argument-hint: "<issue-id-or-number>"
---

Close a Linear issue and confirm it is resolved.

## Steps

1. Normalize the argument to `CHI-N` format (e.g. `18` → `CHI-18`).

2. Fetch the issue via the `linear-server` MCP to get its current state, title, and URL.

   If the state is already `Done` (e.g. a `Closes CHI-N` trailer in a merged commit auto-closed it via the Linear GitHub integration), report that and stop — skip step 3.

3. Call `save_issue` **once** with `state: "Done"` and `labels` set to the issue's current labels (from step 2) minus any triage labels present:
   - `needs-triage`
   - `needs-info`
   - `ready-for-agent`
   - `ready-for-human`
   - `wontfix`

   `save_issue` resolves the state name directly — do not call `list_issue_statuses` to look up the ID first.

4. Report the state, title, and URL from `save_issue`'s response — it already reflects the update, so don't re-fetch the issue just to confirm it.

## Notes

- Do not reopen issues. Only close them.
