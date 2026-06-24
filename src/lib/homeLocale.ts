import type { Locale } from "./locale";
import he from "../../public/locales/he/home.json";
import en from "../../public/locales/en/home.json";
import ar from "../../public/locales/ar/home.json";
import ru from "../../public/locales/ru/home.json";

export const homeByLocale: Record<Locale, Record<string, string>> = {
  he,
  en,
  ar,
  ru,
};
