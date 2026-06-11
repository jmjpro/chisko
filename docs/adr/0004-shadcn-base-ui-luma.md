# shadcn/ui + Base UI (Luma preset) for UI Components

The project adopts shadcn/ui as its component system, with Base UI (`@base-ui/react`) as the underlying headless primitive layer instead of the default Radix UI. The Luma preset is used as a neutral placeholder until a project-specific design system is provided.

## Why Base UI over Radix

Base UI is now shadcn's first-class alternative to Radix. It is built by the same team (including Radix's original author), is more actively maintained, provides a richer component set (Combobox, nested dialogs, hover menus), and uses an explicit `render` prop API rather than `asChild`. The APIs are intentionally similar, keeping future migration cost low.

## Why shadcn (copy-paste model)

Components live directly in `src/components/ui/` as owned source files. There is no shadcn runtime dependency — only `@base-ui/react`, `class-variance-authority`, `clsx`, and `tailwind-merge`. This makes it straightforward to override any component when the design system arrives without fighting a library's public API.

## RTL

`components.json` has `"rtl": true`. All shadcn-generated components use CSS logical properties (`ps-`, `pe-`, `start-`, `end-`, `text-start`) instead of physical ones (`pl-`, `pr-`, `left-`, `right-`, `text-left`). This is consistent with ADR-0003.

## Dark mode

Class-based dark mode (`.dark` on `<html>`). A small inline script in `index.html` sets the class from `localStorage` (key `theme`) before first paint to avoid flash. OS preference is the fallback when no stored value exists.

## Language switcher

The header language picker remains a native `<select>` element styled with design tokens rather than a shadcn `Select` component. Native selects handle mobile OS pickers correctly, are accessible without JavaScript, and are the right primitive for a language chooser.

## Design system placeholder

The Luma preset (neutral/oklch palette) is the current token set. All semantic tokens (`--primary`, `--muted`, `--destructive`, etc.) are expected to be overwritten when the design system is delivered. No component-level color overrides have been introduced so the swap will be a single CSS change.
