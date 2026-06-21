# IEC retrieval extension uses WebExtensions i18n, not react-i18next

CHI-43's browser extension (popup + content scripts injected into iec.co.il and webmail) needs the same Hebrew-default, detect-or-override i18n behavior as the rest of the product, but `CLAUDE.md`'s blanket "all user-visible strings go through react-i18next" rule assumes a React app with a build pipeline — neither of which the extension has (it ships as static manifest/JS files, no bundler). We chose the WebExtensions standard i18n mechanism instead (`_locales/<lang>/messages.json` + `browser.i18n.getMessage()`, with a `chrome` fallback), covering the same four languages (en, he, ar, ru) as separate locale files local to the extension. This is a deliberate, documented carve-out from the `CLAUDE.md` policy for this one deployable artifact, not a precedent for the web app.

The deciding factor was a forthcoming Safari port of the same extension: `browser.i18n`/`_locales` is part of the WebExtensions standard that Safari Web Extensions (14+, full Manifest V3 since 16.4) implement natively, so the locale files and lookup calls carry over to Safari unchanged. Pulling in React + react-i18next, or hand-rolling vanilla i18next, would mean solving locale loading and detection twice — once per browser's extension environment — for no benefit, since neither integrates with the main app's `src/locales` across the extension/web-app process boundary anyway.

## Considered Options

- **Vanilla i18next**, loaded by hand in `popup.js`/content scripts, mirroring the shape of the main app's JSON locale files: rejected because it would still be a second, separately-maintained set of locale files (no shared import path between the extension and the web app), with none of `browser.i18n`'s free OS/browser-locale auto-detection, and no Safari-native equivalent.
- **React + react-i18next in the popup**: rejected as disproportionate tooling weight (a full React runtime and build step) for a settings form and a handful of injected banner strings, and one more thing to re-port to Safari's extension environment.

## Consequences

Extension code must use the `browser.*` WebExtensions namespace (with a `chrome` fallback where Chrome-only APIs are unavoidable, e.g. `chrome.scripting`) rather than `chrome.*`-only calls, so the eventual Safari port doesn't require an API rewrite — only the manifest and any genuinely Chrome-specific pieces.
