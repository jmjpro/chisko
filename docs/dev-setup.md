# Local development setup

## Email (Mailpit)

E2e tests and local form submissions route notification emails through [Mailpit](https://mailpit.axllent.org/) instead of Resend to avoid consuming free-plan quota (see ADR-0030).

**One-time setup:**

```
brew install mailpit
brew services start mailpit
npx convex env set LOCAL_SMTP_HOST localhost
```

Mailpit runs as a macOS system service — one instance shared across all worktrees. Web inbox: `http://localhost:8025`.

If `LOCAL_SMTP_HOST` is unset and `RESEND_API_KEY` is also unset, `sendDeliveryNotification` logs an error and skips delivery rather than throwing.
