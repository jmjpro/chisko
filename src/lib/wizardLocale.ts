import type { Locale } from "./locale";
import he from "../../public/locales/he/wizard.json";
import en from "../../public/locales/en/wizard.json";
import ar from "../../public/locales/ar/wizard.json";
import ru from "../../public/locales/ru/wizard.json";

export const wizardByLocale: Record<Locale, Record<string, string>> = {
  he,
  en,
  ar,
  ru,
};
