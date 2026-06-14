---
name: resolve
description: Close a Linear issue and confirm it is marked as Done. Uses the linear-server MCP.
argument-hint: "<issue-id-or-number>"
---

Close a Linear issue and confirm it is resolved.

## Steps

1. Normalize the argument to `CHI-N` format (e.g. `18` → `CHI-18`).

2. Fetch the issue via the `linear-server` MCP to get its current state, title, and URL.

3. Update the issue's workflow state to `Done` using the `linear-server` MCP (look up the state ID from the team's workflow states if needed).

4. Remove all triage labels currently present on the issue. Check which of these are present and remove only those:
   - `needs-triage`
   - `needs-info`
   - `ready-for-agent`
   - `ready-for-human`
   - `wontfix`

5. Confirm by fetching the issue again and report the state, title, and URL to the user.

## Notes

- Do not reopen issues. Only close them.
- If the issue is already in `Done` state, report that and skip the update.
- If a `Closes CHI-N` trailer was used in a merged commit, Linear may have auto-closed the issue — the confirm step will verify this.
