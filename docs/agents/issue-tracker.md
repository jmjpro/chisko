# Issue tracker: Linear

Issues for this repo live in Linear (team: Chisko, prefix `CHI`). Use the `linear-server` MCP tools for all operations — do **not** use `gh issue` commands.

The MCP is configured as an SSE server at `https://mcp.linear.app/sse` (server name: `linear-server`).

## Conventions

- **Issue IDs**: `CHI-N` format (e.g. `CHI-18`). Accept bare numbers and normalize to `CHI-N`.
- **Read an issue**: use the `linear-server` MCP to fetch the issue by ID.
- **Search issues**: use the `linear-server` MCP search tools.
- **Update workflow state**: use `save_issue` with `state` set to the state name (e.g. `"In Progress"`) — it resolves names directly, no separate lookup call needed.
- **Add / remove labels**: use `save_issue` with `labels` set to the full desired label array (names, not IDs) — it's a set operation, not append-only. Compute the array client-side from labels already fetched on the issue; don't call `list_issue_labels` just to resolve names to IDs.
- **Batch state + label changes**: when both need to change, do it in a single `save_issue` call rather than sequential calls — fewer MCP round trips.

## Commit trailers

Use `Closes CHI-N` or `Fixes CHI-N` in commit messages — **no `#` prefix**. Linear auto-closes issues when commits with these trailers are merged (requires Linear GitHub integration).

## Triage label vocabulary

`needs-triage` · `needs-info` · `ready-for-agent` · `ready-for-human` · `wontfix`

## When a skill says "publish to the issue tracker"

Use the `linear-server` MCP to create a Linear issue in the Chisko team.

## When a skill says "fetch the relevant ticket"

Use the `linear-server` MCP to fetch the issue by its `CHI-N` ID.
