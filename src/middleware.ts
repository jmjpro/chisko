import { defineMiddleware } from "astro:middleware";

type Locale = "he" | "en" | "ar" | "ru";
const LOCALES: readonly Locale[] = ["he", "en", "ar", "ru"];
const PREFIXED_LOCALES = ["en", "ar", "ru"] as const;

export const LANG_COOKIE = "chisko_lang";

function parseAcceptLanguage(header: string | null): Locale {
  if (!header) return "he";
  const tags = header.split(",").map((entry) => {
    const [tag, q] = entry.trim().split(";q=");
    return { lang: tag.split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
  });
  tags.sort((a, b) => b.q - a.q);
  for (const { lang } of tags) {
    if ((LOCALES as readonly string[]).includes(lang)) return lang as Locale;
  }
  return "he";
}

export const onRequest = defineMiddleware(
  ({ request, cookies, redirect }, next) => {
    const { pathname } = new URL(request.url);

    // Skip static assets and Astro internals
    if (pathname.startsWith("/_") || /\.\w+$/.test(pathname)) return next();

    // Skip share link routes — they handle locale via ?lang= query param
    if (pathname.startsWith("/r/")) return next();

    // Skip paths already on a non-default locale prefix
    if (
      PREFIXED_LOCALES.some(
        (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
      )
    ) {
      return next();
    }

    // Cookie (explicit user choice) beats Accept-Language detection
    const cookieVal = cookies.get(LANG_COOKIE)?.value;
    const preferred: Locale = (LOCALES as readonly string[]).includes(
      cookieVal ?? "",
    )
      ? (cookieVal as Locale)
      : parseAcceptLanguage(request.headers.get("accept-language"));

    // Hebrew is the default locale (no prefix) — nothing to do
    if (preferred === "he") return next();

    const target = `/${preferred}${pathname === "/" ? "/" : pathname}`;
    return redirect(target, 302);
  },
);
