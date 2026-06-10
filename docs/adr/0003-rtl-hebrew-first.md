# Hebrew-First RTL Layout from Day One

The primary user base is Israeli Hebrew-speakers. All source documents (electricity bills, IEC smart-meter CSV exports) are in Hebrew. Retrofitting RTL layout onto an LTR codebase is a painful, disruptive migration. We build Hebrew as the primary language with RTL layout from the start, and provide an English toggle for the expat segment (NBN, Anglo communities). Building English-first would delay reaching the dominant audience and create avoidable technical debt at the worst time — during early growth.

## i18n implementation

Translations are handled entirely on the client with `i18next` + `react-i18next`. The Convex database stores only the canonical English name for data records (`suppliers.name`, `plans.name`); no per-language columns exist in the schema. Translations for those names, along with all UI strings, live in `public/locales/{lang}/{namespace}.json` and are loaded at runtime by `i18next-http-backend`.

Supported languages: `he` (Hebrew), `en` (English), `ru` (Russian), `ar` (Arabic).

The active locale is detected from `localStorage` (key `i18n_lang`) then browser `navigator.language`, and defaults to `en` as the i18next `fallbackLng`. Translation namespace files are currently organised by data domain (`suppliers`, `plans`, `payoutStates`, `common`); these will be reorganised by route once routes exist.

Usage pattern for DB-driven names:

```tsx
const { t } = useTranslation("suppliers");
<span>{t(supplier.name)}</span>          // English name is the translation key

const { t } = useTranslation("payoutStates");
<span>{t(state.key)}</span>              // semantic key, e.g. "pending"
```

RTL/LTR direction should be toggled on `<html dir>` when the locale changes (`he` and `ar` are RTL; `en` and `ru` are LTR).
