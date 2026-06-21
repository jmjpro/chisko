import * as Sentry from "@sentry/astro";
import { scrubPii } from "./src/lib/scrubPii";

const dsn = import.meta.env.VITE_SENTRY_DSN_FE;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "development",
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    tracesSampleRate: 1.0,
    beforeSend: scrubPii,
  });
}
