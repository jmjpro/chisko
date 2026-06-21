import type { Locale } from "./locale";
import he from "../../public/locales/he/common.json";
import en from "../../public/locales/en/common.json";
import ar from "../../public/locales/ar/common.json";
import ru from "../../public/locales/ru/common.json";

export const commonByLocale: Record<Locale, Record<string, string>> = {
  he,
  en,
  ar,
  ru,
};
