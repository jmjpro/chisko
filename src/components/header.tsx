import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

export default function Header() {
  const { i18n, t } = useTranslation();

  useEffect(() => {
    const lang =
      LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? LANGUAGES[0];
    document.documentElement.dir = lang.dir;
    document.documentElement.lang = lang.code;
  }, [i18n.resolvedLanguage]);

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    void i18n.changeLanguage(e.target.value);
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b">
      <span className="text-xl font-bold tracking-tight">EC2</span>
      <select
        value={i18n.resolvedLanguage}
        onChange={handleLanguageChange}
        aria-label={t("language")}
        className="text-sm border rounded px-2 py-1 bg-transparent"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </header>
  );
}
