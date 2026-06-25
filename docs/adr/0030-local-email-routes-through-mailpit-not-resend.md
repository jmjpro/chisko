# Local email routes through Mailpit (SMTP), not Resend

E2e tests submit real lead forms against the local Convex backend, which creates `formSubmissionDeliveries` rows. The cron's `ENABLE_CONVEX_CLOUD` guard (ADR-0024) is a production kill-switch, not a local-dev guard — locally it's unset, so `runBatch` fires and `sendDeliveryNotification` calls Resend for real, burning free-plan quota.

Fix: `sendDeliveryNotification` checks `LOCAL_SMTP_HOST` (a Convex env var). When set, it routes through nodemailer to a local SMTP server (Mailpit) instead of the Resend HTTP API. When absent (staging, production), it falls through to Resend unchanged. If neither `LOCAL_SMTP_HOST` nor `RESEND_API_KEY` is set, the action logs an error and no-ops rather than throwing, so a misconfigured local env fails visibly but softly.

Mailpit is installed via `brew install mailpit` and run as a system service (`brew services start mailpit`) — not wired into `npm run dev`. This keeps a single instance running across all worktrees, since only the main worktree runs `convex dev` and multiple worktrees would otherwise start competing instances.

`LOCAL_SMTP_HOST` is set once on the local Convex deployment (`npx convex env set LOCAL_SMTP_HOST localhost`). E2e tests inherit it automatically. Unit tests in `email.test.ts` are unaffected — they mock both transports at the vitest level (`vi.stubGlobal("fetch", ...)` for Resend, `vi.mock("nodemailer", ...)` for SMTP).

One-time local setup:

```
brew install mailpit
brew services start mailpit
npx convex env set LOCAL_SMTP_HOST localhost
```

Mailpit's web inbox is at `http://localhost:8025`.

## Considered options

- **`ENABLE_CONVEX_CLOUD=false` locally**: would block all cloud-touching crons, not just email. Too broad; breaks other local testing.
- **No-op when `RESEND_API_KEY` absent**: stops quota burn but gives no local inbox to inspect. Mailpit gives a real web UI at `localhost:8025`.
- **Wire mailpit into `npm run dev`**: causes port conflicts when multiple worktrees are open; orphaned process on Ctrl+C. Brew service is cleaner.
- **Abstract a transport interface**: one location uses email, two transports — an interface adds indirection with no payoff. Inline `if (LOCAL_SMTP_HOST)` in `email.ts` is sufficient.

## Consequences

- E2e tests and local form submissions no longer consume Resend quota.
- Developers must run the one-time setup above to get email delivery working locally; without it, notifications are silently skipped (logged as an error).
- `convex/email.ts` requires `"use node"` because nodemailer uses Node.js built-in modules.
