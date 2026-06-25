# URL-Based Locale Routing via Astro Middleware

Supersedes the i18n implementation section of [ADR-0003](0003-rtl-hebrew-first.md). Note: ADR-0009 stated "Astro hybrid mode" as the deployment target. In Astro 6, `output: "hybrid"` was removed — `output: "static"` now covers the same behaviour (middleware deploys as an edge route handler). This ADR documents how the two i18n layers relate and confirms the correct output setting.

## Problem

`src/middleware.ts` handles locale detection (cookie → `Accept-Language` header) and redirects new users to their locale-prefixed URL (`/en/`, `/ar/`, `/ru/`). In Astro versions prior to 5, `output: "static"` caused the Vercel adapter to skip compiling middleware as an edge function; this behaviour was only activated with `output: "hybrid"` or `"server"`. Astro 6 resolved this by merging hybrid into static, but that left the client-side i18n setup decoupled from URL-based routing.

A secondary conflict: ADR-0003 described a fully client-side i18n approach using `i18next-browser-languagedetector` with `localStorage` (`i18n_lang`) then `navigator.language`. The Astro migration added URL-based routing on top without removing the client-side detector. The two systems are decoupled — the cookie (`chisko_lang`) that drives the middleware and the `localStorage` key (`i18n_lang`) that drives i18next are entirely separate.

## Decision

### 1. Keep `output: "static"` — Astro 6 deploys middleware automatically

Astro 6 removed `output: "hybrid"` and folded its behaviour into `output: "static"`. In Astro 6+, `output: "static"` already causes the Vercel adapter to compile `src/middleware.ts` as a Vercel Edge route handler (`functions/_middleware.func/`). All pages remain pre-rendered at build time and are served from the CDN.

`output: "server"` (full SSR) was considered and rejected: it converts every page into a serverless function invocation, losing CDN caching on static content that has no per-request data needs.

### 2. URL path is the authoritative locale source

The locale flows in one direction:

```
middleware redirect → Astro page param (or hardcoded "he") → React island prop → i18n.changeLanguage()
```

- Hebrew (`he`) is the default locale, served at `/` with no prefix.
- All other locales are served at `/{locale}/` and redirected to by the middleware on first visit.
- The `locale` value derived from the URL is passed as a prop to every React island that needs it (`HeaderIsland`, etc.), which calls `i18n.changeLanguage(locale)` on mount.

### 3. Remove `LanguageDetector` from i18next

`i18next-browser-languagedetector` is removed from `src/i18n.ts`. The detection order (`localStorage → navigator`) is now dead code — the locale is always supplied by the Astro page. `fallbackLng` is changed from `"en"` to `"he"` to match the default locale. The `i18n_lang` localStorage key described in ADR-0003 is no longer written or read.

## Vercel Edge Invocation Model

The Astro middleware is compiled as a **Vercel Edge route handler**, not a global pre-CDN interceptor. This distinction matters for billing:

- Static assets (`/_astro/**`) are stored in `.vercel/output/static/` and served directly by Vercel's CDN. They are never routed to the edge function.
- HTML page requests (navigation) are routed to `_middleware` and count as edge invocations.
- Cost model: **one invocation per page view**, not per asset. At Vercel's free tier limit of 1 million invocations/month, this is equivalent to ~1 million page views.

## Astro 6 Dev Mode Caveat

In Astro 6 dev mode, Astro's own route handling receives an **empty headers object** for requests to prerendered pages, so `request.headers.get("accept-language")` would return `null` if `middleware.ts` were invoked through Astro's normal pipeline. `localeDevMiddleware.ts` (an `astro:server:setup` integration registered in `astro.config.mjs`) works around this by running `middleware.ts` directly against the dev server's raw Connect request — which still has real headers — before Astro's pipeline ever sees it. This makes the locale redirect observable under `npm run dev` / `astro dev`, matching the Vercel production edge function, without changing the compiled production middleware at all.

As a result, the `parseAcceptLanguage` logic is covered by unit tests (`middleware.test.ts`) and can also be exercised manually (or via e2e) against the local dev server.

### Rewrite signal handling (CHI-87)

`middleware.ts` also calls `rewrite()` from `@vercel/functions` to serve a locale's static 404 page for unmatched paths under a known locale prefix (see `src/lib/routes.ts`'s `TOP_LEVEL_ROUTES`). `rewrite()` returns an empty `200` response carrying an `x-middleware-rewrite` header — Vercel's edge platform reads that header and internally re-serves the target path's real response in production. That interception doesn't exist in `astro dev`. `localeDevMiddleware.ts` therefore special-cases this: when the response from `middleware()` carries `x-middleware-rewrite`, it rewrites `req.url` to the destination's path and calls `next()` (so Vite/Astro's own pipeline serves the real target page) instead of writing the synthetic response straight to the client.

## Consequences

- The `chisko_lang` cookie (set by the language switcher in `header.tsx`) remains the mechanism for persisting an explicit user language choice across sessions. The middleware reads it on every request and skips the `Accept-Language` fallback when it is present.
- Wizard state is preserved across language switches because the wizard island calls `i18n.changeLanguage()` directly without URL navigation (documented in ADR-0009).
- The `i18n_lang` localStorage key is orphaned in existing users' browsers. It has no effect once `LanguageDetector` is removed.
