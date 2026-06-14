# Issue tracker: Linear

Issues for this repo live in Linear (team: Chisko, prefix `CHI`). Use the `linear-server` MCP tools for all operations — do **not** use `gh issue` commands.

The MCP is configured as an SSE server at `https://mcp.linear.app/sse` (server name: `linear-server`).

## Conventions

- **Issue IDs**: `CHI-N` format (e.g. `CHI-18`). Accept bare numbers and normalize to `CHI-N`.
- **Read an issue**: use the `linear-server` MCP to fetch the issue by ID.
- **Search issues**: use the `linear-server` MCP search tools.
- **Update workflow state**: use the `linear-server` MCP update tool; look up state IDs from the team's workflow states if needed.
- **Add / remove labels**: use the `linear-server` MCP update tool; look up label IDs from the team's labels if needed.

## Commit trailers

Use `Closes CHI-N` or `Fixes CHI-N` in commit messages — **no `#` prefix**. Linear auto-closes issues when commits with these trailers are merged (requires Linear GitHub integration).

## Triage label vocabulary

`needs-triage` · `needs-info` · `ready-for-agent` · `ready-for-human` · `wontfix`

## When a skill says "publish to the issue tracker"

Use the `linear-server` MCP to create a Linear issue in the Chisko team.

## When a skill says "fetch the relevant ticket"

Use the `linear-server` MCP to fetch the issue by its `CHI-N` ID.
