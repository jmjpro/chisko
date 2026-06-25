import type { Locale } from "./locale";
import he from "../../public/locales/he/notFound.json";
import en from "../../public/locales/en/notFound.json";
import ar from "../../public/locales/ar/notFound.json";
import ru from "../../public/locales/ru/notFound.json";

export const notFoundByLocale: Record<Locale, Record<string, string>> = {
  he,
  en,
  ar,
  ru,
};
