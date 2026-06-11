---
name: push
description: Push the current branch to origin. If a push hook fails, shows the full hook output and asks the user whether to override before retrying.
argument-hint: "[remote] [branch]"
---

Push the current branch to origin (or the remote/branch specified in the arguments).

## Steps

1. Run `git push` (with `-u origin <branch>` if no upstream is set yet). Capture both stdout and stderr.

2. **If the push succeeds**: report the remote URL and any printed output.

3. **If a git hook fails** (pre-push or server-side hook):
   - Show the complete hook output verbatim so the user can read it.
   - Ask: "The push hook failed. Do you want to skip the hook with `--no-verify` and push anyway?"
   - Wait for the user's answer before doing anything.
   - If they say yes, run `git push --no-verify` (same remote/branch).
   - If they say no, stop.

4. **If the push is rejected** for any other reason (non-fast-forward, permissions, etc.), explain the rejection and suggest a remedy — do not force-push without explicit user instruction.

## Notes

- Never force-push to `main` or `master` under any circumstances. Warn loudly if the user requests it.
- `--no-verify` bypasses hooks — only use it after the user explicitly approves.
