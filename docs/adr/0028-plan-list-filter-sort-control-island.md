> **Superseded in part by [ADR-0029](0029-plan-row-single-template-css-grid-reflow.md)** for the two-tree DOM structure: the dual `#plan-table-body`/`#plan-card-list` containers described here have been consolidated into a single `#plan-rows` container (CHI-92). The island's filter/sort approach (thin control island, `data-*` attribute-driven, `hidden` class toggling) is unchanged.

# Plan-list filter/sort as a thin control island over static rows

`/plans` renders its rows/cards as static Astro HTML; only the CTA buttons (`ClickThroughIsland`, `LeaveDetailsIsland`) are per-row React islands. ADR-0009 claimed a "React Island for client-side search and filter" already existed on `/plans` — it didn't, the same way ADR-0009's header claim was never actually built (see ADR-0014). For CHI-70 (visitor-driven filter and sort), rows/cards stay static: a single new React island holds only the filter checkboxes and sort controls, and manipulates the existing static DOM directly — toggling a `hidden` class for filtering, reordering nodes via `insertBefore` for sorting — reading criteria from `data-*` attributes already present on each row/card. No island owns or re-renders the row list itself.

Default sort (discount %, descending) is applied server-side in `plans.astro`'s frontmatter, so the static HTML and crawlers already see the correct order with zero JS; the island only takes over for visitor-driven changes after hydration. Filter/sort state is ephemeral client state, not reflected in the URL, and resets on reload. Ships on all four locale routes (`/plans` and `/[locale]/plans`).

## Considered Options

A single data-driven island owning the full row/card list, receiving plan data as props and re-rendering on every change — rejected because it would convert the existing per-row CTA islands into nested components and ship row templating as JS, which is currently zero-JS content per ADR-0009/ADR-0014's minimal-JS philosophy.

## Amendment — CHI-113: mobile sort control and CLS fix

**Mobile sort: `@base-ui/react/select` (not `Menu` + `RadioGroup`)**. The filter controls use `Menu.CheckboxItem` (multi-select, category label fixed in trigger). Sort is inherently single-select and the trigger should display the current field name — that is the `Select` primitive's native behaviour. Using `Menu` + `RadioGroup` would require manually rendering the selected value in the trigger. `Select` is semantically correct and removes that boilerplate. Trigger styled identically to the filter buttons (`px-3 py-1.5 text-sm border border-input rounded-md`); trigger content is `sort_by_label` (bold, static) + `<Select.Value />` (current field) + chevron. Sort direction remains a per-field default; mobile exposes field selection only, matching the existing behaviour.

**CLS fix: `min-height` wrapper in `PlansPage.astro`**. `PlanFilterSortIsland` uses `client:only="react"` (required — i18n loads via HTTP backend, SSR is not viable). Before hydration, Astro emits no HTML for the island, so the plan table jumps down when the controls appear. Fix: wrap the island in a `<div>` with `min-h-[84px] md:min-h-[34px]` and move `mb-6` from the island's root div to that wrapper. The `84px` covers two 34 px button rows plus the 16 px `gap-4` between them on mobile; `34px` covers the single filter-button row on desktop.
