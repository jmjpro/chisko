<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

The project uses a local-first approach for development as opposed to a traditiona Convex cloud-first approach.

<!-- convex-ai-end -->
## File Naming
File names should be camel-case. This works best with Convex tooling.

## Internationalization (i18n)

All user-visible strings must go through react-i18next — no hardcoded strings in components or server-generated human-readable text.

Namespace rules:
- Strings used on a single route live in that route's namespace (e.g. `wizard.json` for `/wizard`, `recommendations.json` for recommendation display).
- Strings used across multiple routes go in `common.json`.
- Server-side code (Convex functions) cannot use react-i18next; emit structured i18n keys (serialized as JSON) and translate on the client.

Supported languages: `en`, `he`, `ar`, `ru`. All four locale files must be updated together.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `jmjpro/chisko` (uses the `gh` CLI). See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo: one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
