export type Locale = "he" | "en" | "ar" | "ru";
export const LOCALES: readonly Locale[] = ["he", "en", "ar", "ru"];
export const PREFIXED_LOCALES = ["en", "ar", "ru"] as const;

export const LANG_COOKIE = "chisko_lang";

export function parseAcceptLanguage(header: string | null): Locale {
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
