# Plans page renders one row template per breakpoint, not two static trees

ADR-0028 gave `/plans` two separate static DOM trees — a `<table>` for desktop and a `<div>` card list for mobile — with `PlanFilterSortIsland` filtering/sorting both in lockstep. CHI-89 showed the failure mode: a per-row feature (`ClickThroughIsland`) was added to the table but not the card list, so mobile visitors silently lost a CTA. Any future per-row feature carries the same risk as long as two trees exist.

**Decision:** render each plan row once, as a `<div role="row">` (the table itself becomes `<div role="table">`, headers `role="columnheader"`, cells `role="cell"`), and use CSS Grid `grid-template-areas` to reflow that single markup into the existing mobile card look and existing desktop table look at their respective breakpoints — no visual redesign, same two appearances, but now backed by one DOM tree instead of two. Each cell renders its own label unconditionally (shown inline on mobile, hidden on desktop where the column header already provides it), which is what makes one template able to stand in for both designs. `PlanFilterSortIsland` now targets a single row container instead of two.

We use `<div>` + explicit ARIA roles instead of real `<table>`/`<tr>`/`<td>` elements because overriding a table element's `display` away from its native table/row/cell mode fights browsers' implicit table accessibility semantics once the visual layout (mobile's stacked card) no longer matches a grid of rows/columns — explicit roles avoid that mismatch at the cost of writing the ARIA wiring by hand.

## Consequences

- `e2e/plans.spec.ts`'s `plan-card` testid and the "table is hidden at this viewport" / "card is hidden at that viewport" exclusivity assertions no longer apply, since there's only one element now. They're replaced with layout assertions (badge position, full-width CTA, column header rendered once) at each viewport.
- Any future per-row feature is added once and appears at both breakpoints by construction — the CHI-89 failure mode is no longer structurally possible.
