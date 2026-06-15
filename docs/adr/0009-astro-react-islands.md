# Astro + React Islands replacing Vite SPA

The app is an SEO-focused lead-generation tool targeting Israeli mobile users. The existing Vite SPA ships a full React + Convex bundle on every page, blocking meaningful content from crawlers and delaying LCP on mobile. We are migrating to Astro in hybrid mode (static + on-demand SSR) with React Islands, hosted on Vercel.

## Rendering strategy per route

- **Content pages** (home, plans, future marketing pages): SSG, pre-rendered per locale at build time. No JS ships to these pages except the search/filter island on `/plans`.
- **Wizard** (`/wizard`): a single React Island with `client:load`. Header and footer are static Astro HTML. The Convex SDK ships only with this island — not on any other page.
- **Share links** (`/r/[code]`): `prerender = false` (on-demand SSR). OG/meta tags are server-rendered so WhatsApp/social previews work. Convex data is fetched server-side via `ConvexHttpClient` (plain HTTP, no WebSocket). Interactive display hydrates client-side.

## Why not Next.js or staying on Vite

Next.js was not chosen because Convex has no SSR data-fetching adapter — its data layer is client-side WebSocket subscriptions. Next.js's RSC and SSR primitives would add complexity with no benefit for Convex-driven pages; we'd still get loading skeletons on first paint for any page that touches Convex data. Astro's Islands model is honest about this: static pages are genuinely static, and Convex runs only in the islands that need it.

Staying on Vite SPA was not viable because Google's crawler cannot index meaningful content from a JS SPA, and the full React + Convex bundle ships on every page load including the home page which has no dynamic data.

## i18n and locale routing

Astro's built-in locale routing (`/he/`, `/ar/`, `/en/`, `/ru/`) is used. The `dir` attribute (`ltr`/`rtl`) is set in the static `<html>` tag at build time, eliminating the RTL flash present in the SPA. This produces a 4x build output (one static site per locale), which is acceptable given the small number of pages.

Language switching inside the wizard island is handled client-side via `i18n.changeLanguage()` without URL navigation, preserving wizard state (which lives in React `useState` and is not persisted to Convex until submission).

## Plans page rebuild trigger

The `/plans` page is SSG with a React Island for client-side search and filter. Plan data is fetched via `ConvexHttpClient` at build time and passed as props to the island — no Convex WebSocket connection on this page at runtime. When plans change in Convex, the mutating function schedules an action via `ctx.scheduler.runAfter(0, ...)` that POSTs to a Vercel deploy hook, triggering a rebuild within minutes of the data change.

## Hosting

Vercel, free tier initially. Vercel's hybrid mode serves static routes from CDN and SSR routes (`/r/[code]`) from serverless functions. Cloudflare Workers would reduce SSR latency for Israeli users (edge PoP in Tel Aviv vs. Frankfurt for Vercel serverless), but Vercel's superior DX and zero npm compatibility risk make it the right starting point. Revisit if share-link load time becomes a measured conversion issue.
