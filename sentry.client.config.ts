import * as Sentry from "@sentry/astro";
import { scrubPii } from "./src/lib/scrubPii";

const dsn = import.meta.env.VITE_SENTRY_DSN_FE;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "development",
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [Sentry.replayIntegration()],
    tracesSampleRate: 1.0,
    // Replay only records sessions that error — Sentry's free tier caps replays
    // at 50/month, and session-based sampling would exhaust that immediately.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    beforeSend: scrubPii,
  });
}
