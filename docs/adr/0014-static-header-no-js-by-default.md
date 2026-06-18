# Header is static markup with no JS by default, not a React island

`HeaderIsland` was mounted with `client:only="react"` on every route (`index`, `plans`, `r/[code]`), meaning the header had **zero server-rendered HTML** — it popped in after hydration, on top of already-painted page content, pushing that content down (CHI-44). On `/wizard`, the header was instead rendered *inside* `WizardIsland`'s own `client:only` island, so it was blank-then-present together with the rest of the wizard rather than shifting anything — a different problem, but still not what ADR-0009 described.

ADR-0009 stated "Header and footer are static Astro HTML," but this was never actually implemented for the header — `footer.tsx` achieves it today only because it's a React component rendered with no `client:*` directive (so Astro emits static HTML, no JS shipped); the header never used that pattern and always shipped as a hydrated island.

## Decision

The header is now rendered inside `BaseLayout.astro` (so no page can omit it, which is how `/wizard` ended up without one) as plain markup with no `client:*` directive and no React island:

- Logo, brand link, and language `<select>` are static HTML. i18n strings come from the locale's `common.json`, read server-side in frontmatter — the same pattern other pages already use for static content, not `react-i18next`.
- The language switcher is wired with a small inline `<script is:inline>` (same pattern as the existing dark-mode-flash script): on most routes it sets the `chisko_lang` cookie and navigates via the page's `langSwitchUrls`; on `/wizard` it sets the cookie and dispatches a `chisko:lang-change` `CustomEvent` instead of navigating, which `WizardIsland` listens for and forwards to `i18n.changeLanguage()` — preserving in-progress wizard state, per ADR-0009's original reasoning for avoiding navigation there.
- The theme menu (light/dark/system) is rebuilt with a native `<details>/<summary>` disclosure instead of Base UI's `Menu` component, with a small inline script applying the theme class and persisting `localStorage`. This trades some of Base UI's accessibility polish (roving focus, escape-to-close) for shipping zero JS framework code in the header.

`langSwitchUrls` remains a per-page prop threaded into `BaseLayout` rather than derived generically, because `/r/[code]` switches locale via a `?lang=` query param (it's on-demand SSR, not statically prerendered per locale) while every other route uses path-prefix routing (ADR-0010) — there's no single rule `BaseLayout` could apply to compute it.

`components/header.tsx` and `islands/HeaderIsland.tsx` are removed; there is no header React component or island anymore.
