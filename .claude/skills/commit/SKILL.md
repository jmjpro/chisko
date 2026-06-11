---
name: commit
description: Stage relevant files and create a conventional commit that references a GitHub issue. Writes a message with a Closes/Fixes trailer so the issue auto-closes on merge.
argument-hint: "<issue-number> [optional commit message hint]"
---

Stage the relevant files and commit them with a conventional message that references the given issue number.

## Steps

1. Run `git status` and `git diff --stat` to see what has changed.

2. Stage only the files that are part of the work for this issue — use `git add <file> <file> ...` (never `git add -A` or `git add .`). If unrelated files are modified, leave them unstaged and note them to the user.

3. Write a conventional commit message:
   - **Subject** (≤72 chars): imperative mood, no period. E.g. `feat: replace address selects with typeahead combobox`
   - **Body** (optional blank line + 1-2 sentences): the *why*, only if non-obvious.
   - **Trailer block**:
     ```
     Closes #<issue-number>
     Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
     ```
   - Use `Fixes #N` for bugs, `Closes #N` for features/tasks. Both auto-close on GitHub.

4. Commit using a HEREDOC so formatting is preserved:
   ```bash
   git commit -m "$(cat <<'EOF'
   subject line here

   Optional body here.

   Closes #N
   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

5. If a pre-commit hook fails, report the hook output clearly and stop — do NOT retry or use `--no-verify` unless the user explicitly asks.
