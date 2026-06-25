# Plan-list filter/sort as a thin control island over static rows

`/plans` renders its rows/cards as static Astro HTML; only the CTA buttons (`ClickThroughIsland`, `LeaveDetailsIsland`) are per-row React islands. ADR-0009 claimed a "React Island for client-side search and filter" already existed on `/plans` — it didn't, the same way ADR-0009's header claim was never actually built (see ADR-0014). For CHI-70 (visitor-driven filter and sort), rows/cards stay static: a single new React island holds only the filter checkboxes and sort controls, and manipulates the existing static DOM directly — toggling a `hidden` class for filtering, reordering nodes via `insertBefore` for sorting — reading criteria from `data-*` attributes already present on each row/card. No island owns or re-renders the row list itself.

Default sort (discount %, descending) is applied server-side in `plans.astro`'s frontmatter, so the static HTML and crawlers already see the correct order with zero JS; the island only takes over for visitor-driven changes after hydration. Filter/sort state is ephemeral client state, not reflected in the URL, and resets on reload. Ships on all four locale routes (`/plans` and `/[locale]/plans`).

## Considered Options

A single data-driven island owning the full row/card list, receiving plan data as props and re-rendering on every change — rejected because it would convert the existing per-row CTA islands into nested components and ship row templating as JS, which is currently zero-JS content per ADR-0009/ADR-0014's minimal-JS philosophy.
