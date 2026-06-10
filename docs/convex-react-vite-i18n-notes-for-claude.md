# Convex + React Vite i18n Notes

This document summarizes the recommended approach for handling translations in a lightly modified Convex app scaffolded from the React + Vite template.

## Recommendation

Use `i18next` with `react-i18next` on the frontend for static UI strings, and keep Convex out of the translation path unless the app later needs account-based locale syncing or truly multilingual database content.[cite:11]

For a React + Vite + TypeScript SPA, `react-i18next` remains the standard, mature choice in mid-2026 because it has a large ecosystem, supports namespaces, pluralization, interpolation, lazy loading, and multiple backends/plugins.[cite:21][cite:30]

## Why not store translations in Convex

Static interface text such as buttons, labels, onboarding copy, and empty states should not live in Convex tables for v1. Shipping that copy as locale files is simpler and avoids unnecessary backend reads for content that can be resolved entirely on the client.[cite:11]

Convex is still a good place for locale-aware application data later on, such as user profile locale, multilingual records, or CMS-like content where fields differ by language.[cite:13]

## Performance on mobile

`react-i18next` is not especially lightweight compared with smaller alternatives, but it is usually fine if configured correctly. The main performance risk is not the runtime itself; it is eagerly loading too many locale files or too many namespaces on first paint.[cite:21][cite:24][cite:33]

To keep mobile page loads fast:

- Load only the active language at startup.[cite:42]
- Load only a small `common` namespace plus the current route namespace initially.[cite:33]
- Split translations by route or feature, such as `auth`, `dashboard`, and `settings`, instead of one giant file per language.[cite:33][cite:35]
- Lazy-load additional namespaces when routes or components mount.[cite:31][cite:35]
- Cache locale JSON responses normally if they are served over HTTP.[cite:35]

A good v1 target is: initial load = one language + `common` + current route namespace, and everything else deferred.[cite:33][cite:35]

## Anonymous users and locale persistence

If users do not have logins in v1, there is no need to store locale in Convex. A client-side preference store is enough.[cite:52][cite:56]

Recommended order for an anonymous Vite SPA:

1. Detect browser language on first visit.[cite:52]
2. Allow the user to switch language manually.[cite:55]
3. Persist the chosen locale in `localStorage`.[cite:51][cite:56]
4. Optionally mirror it to a cookie later only if server-side or edge logic needs to know the locale before the app loads.[cite:49][cite:56]

`sessionStorage` is usually a weaker option for language preference because it disappears when the tab or browser session ends.[cite:50][cite:52]

## Recommended persistence choice

For this app shape, `localStorage` is the cleanest default for locale preference because language is non-sensitive UI state and does not need to be sent on every request.[cite:51][cite:56]

Use a cookie only if one of these becomes true later:

- Locale-aware redirects are needed before React boots.[cite:53][cite:56]
- The server must choose markup or assets by locale.[cite:49][cite:56]
- Multiple apps on the same domain should share the same language preference.[cite:49][cite:52]

## Example file structure (complements Convex + React-Vite scaffold)

This structure fits a standard Convex + React + Vite scaffold and keeps translations on the client rather than in Convex.

```text
/
  convex/
    _generated/
      # Auto-generated Convex types (ignore edits)
    validations.ts
    users.ts
    # Keep Convex for data only; not for static UI translations
  public/
    locales/
      en/
        common.json
        auth.json
        dashboard.json
        settings.json
      he/
        common.json
        auth.json
        dashboard.json
        settings.json
    index.html
  src/
    i18n.ts
    i18n-provider.tsx
    locales/
      types.ts
      en-common.json
      he-common.json
      # Optional: typed imports for common cases
    components/
      LanguageSwitcher.tsx
      Layout.tsx
    pages/
      HomePage.tsx
      AuthPage.tsx
      DashboardPage.tsx
      SettingsPage.tsx
    App.tsx
    main.tsx
  vite.config.ts
  package.json
```

Key points:

- `public/locales/{lang}/{namespace}.json` aligns with `i18next-http-backend` and `loadPath: "/locales/{{lng}}/{{ns}}.json"`.[cite:11]
- `src/i18n.ts` initializes i18next with namespaces, language detection, and localStorage persistence.
- `src/locales/types.ts` exports typed translation keys for TypeScript safety.
- Namespaces align with major pages or features: `common`, `auth`, `dashboard`, `settings`.
- `LanguageSwitcher.tsx` exposes a small UI for switching language and persisting the choice to localStorage.

## Usage pattern in components

```tsx
import { useTranslation } from "react-i18next";

function HomePage() {
  const { t } = useTranslation("common");
  return <h1>{t("welcome_title")}</h1>;
}

function AuthPage() {
  const { t } = useTranslation("auth");
  return <h1>{t("login_title")}</h1>;
}
```

## String authoring guidance

Write translation strings so they are easy to localize and safe for future Hebrew support:

- Prefer full phrases over concatenated fragments.[cite:7]
- Use interpolation for values like names or counts instead of string concatenation.[cite:7]
- Use proper pluralization rules instead of manual singular/plural branching.[cite:7][cite:21]
- Separate translation keys by context when the English word could mean different things.[cite:7]
- Test layouts with longer strings and RTL support early, because localization issues often show up in spacing, truncation, alignment, and directionality rather than in the translation files themselves.[cite:7]

## Bottom-line guidance for Claude

For a lightly modified Convex React-Vite scaffold, implement i18n entirely on the client with `i18next` + `react-i18next`, store the chosen locale in `localStorage`, load only the active language and minimal namespaces on startup, and keep Convex out of locale persistence until real user accounts or multilingual database content actually require it.[cite:11][cite:33][cite:35][cite:56]
