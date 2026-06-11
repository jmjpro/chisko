---
name: cpr
description: Commit, Push, and Resolve — runs /commit then /push then /resolve in sequence for a given GitHub issue.
argument-hint: "<issue-number> [optional commit message hint]"
---

Run the three sub-skills in sequence to ship work and close the linked issue.

1. Invoke `/commit <issue-number> <optional hint>` — stages files and creates a conventional commit with a `Closes #N` trailer.
2. Invoke `/push` — pushes to origin; handles hook failures interactively before continuing.
3. Invoke `/resolve <issue-number>` — confirms the issue is closed on GitHub.

Pass the issue number (and any optional context) through to each step. Stop if any step fails and report what happened before proceeding.
