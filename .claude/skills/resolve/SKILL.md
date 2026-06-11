---
name: resolve
description: Close a GitHub issue and confirm it is marked as resolved. Uses the gh CLI.
argument-hint: "<issue-number> [repo owner/name — defaults to current repo]"
---

Close a GitHub issue and confirm it is resolved.

## Steps

1. Determine the repo: use `gh repo view --json nameWithOwner` to get the current repo, or use the one passed in the arguments.

2. Close the issue:
   ```bash
   gh issue close <issue-number> --repo <owner/repo>
   ```

3. Confirm by viewing the issue:
   ```bash
   gh issue view <issue-number> --repo <owner/repo> --json state,title,url
   ```
   Report the state, title, and URL to the user.

## Notes

- If `gh` is not found in PATH, check `/opt/homebrew/bin/gh`. If still missing, tell the user to run `! which gh` so its location appears in the session.
- If you already have a commit with `Closes #N` / `Fixes #N` that has been pushed to the default branch, GitHub will have auto-closed the issue — the confirm step will verify this. No need to close it manually in that case; this skill is still useful to confirm.
- Do not reopen issues. Only close them.
