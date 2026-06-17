# Sentry Integration — Architecture Diagram

> Companion diagram for [`docs/adr/0013-sentry-scope-environments-and-pii-handling.md`](adr/0013-sentry-scope-environments-and-pii-handling.md).
> To regenerate: ask Claude Code to "regenerate docs/sentry-integration-diagram.md from ADR-0013 and the current Sentry wiring."

```mermaid
flowchart TB
    subgraph Frontend["Astro / React frontend"]
        FE_CODE["React components<br/>(bill upload, address, contact forms)"]
        FE_INIT["sentry.client.config.ts<br/>Sentry.init(...)"]
        FE_SCRUB["src/lib/scrubPii.ts<br/>beforeSend: scrubPii"]
        FE_REPLAY["Replay integration<br/>maskAllText / blockAllMedia (defaults)<br/>sessionSampleRate 0, errorSampleRate 1.0"]

        FE_CODE -- "uncaught error" --> FE_INIT
        FE_INIT --> FE_SCRUB
        FE_INIT --> FE_REPLAY
    end

    subgraph Backend["Convex backend (actions / httpActions only)"]
        BE_SITES["billImports.ts<br/>israelPlacesRefresh.ts<br/>smartMeterRegistryRefresh.ts<br/>http.ts<br/>internal/seedAll.ts<br/>internal/deployHooks.ts"]
        BE_WRAP["withCapturedExceptions(fn, context)"]
        BE_HELPER["convex/lib/sentry.ts<br/>captureException()"]
        BE_REDACT["redact() — strips name/phone/email/<br/>street/houseNumber/placeOfResidence"]
        BE_NOACCESS["Queries & mutations<br/>(deterministic V8 isolate, no network)<br/>→ visible only in Convex dashboard"]

        BE_SITES -- "try/catch" --> BE_WRAP
        BE_WRAP -- "on error" --> BE_HELPER
        BE_HELPER --> BE_REDACT
    end

    FE_SCRUB -- "POST event (scrubbed)" --> SENTRY_FE
    BE_REDACT -- "POST to ingest API /store/<br/>(plain fetch, X-Sentry-Auth header)" --> SENTRY_BE

    subgraph Sentry["Sentry — 4 projects, env-tagged"]
        SENTRY_FE["chisko-prod-fe<br/>chisko-dev-fe<br/>(environment: production | preview)"]
        SENTRY_BE["chisko-prod-be<br/>chisko-dev-be<br/>(environment: production | preview)"]
    end

    subgraph Build["Build chain (vercel.json, see ADR-0012)"]
        VERCEL_SHA["VERCEL_GIT_COMMIT_SHA"]
        VITE_DEFINE["astro.config.mjs vite.define<br/>VITE_SENTRY_RELEASE ← VERCEL_GIT_COMMIT_SHA<br/>(threads SHA to frontend bundle)"]
        SOURCEMAPS["@sentry/astro Vite plugin<br/>uploads source maps<br/>(SENTRY_ORG / SENTRY_PROJECT / SENTRY_AUTH_TOKEN)"]

        VERCEL_SHA --> VITE_DEFINE
        VITE_DEFINE --> SOURCEMAPS
    end

    SOURCEMAPS -. "release tag + resolved stack traces" .-> SENTRY_FE
    BE_NOACCESS -.->|"not reported to Sentry"| BE_NOACCESS
```
