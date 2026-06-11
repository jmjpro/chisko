import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu } from "@base-ui/react/menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const LANGUAGES = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "he", label: "עברית", dir: "rtl" },
  { code: "ru", label: "Русский", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
] as const;

type ThemeMode = "light" | "dark" | "system";

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem("theme");
  if (stored === "dark") return "dark";
  if (stored === "light") return "light";
  return "system";
}

function applyTheme(mode: ThemeMode) {
  const dark =
    mode === "dark" ||
    (mode === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  if (mode === "system") {
    localStorage.removeItem("theme");
  } else {
    localStorage.setItem("theme", mode);
  }
}

const THEME_OPTIONS: {
  mode: ThemeMode;
  icon: React.ReactNode;
  labelKey: string;
}[] = [
  { mode: "light", icon: <Sun size={15} />, labelKey: "theme_light" },
  { mode: "dark", icon: <Moon size={15} />, labelKey: "theme_dark" },
  { mode: "system", icon: <Monitor size={15} />, labelKey: "theme_system" },
];

const CURRENT_ICON: Record<ThemeMode, React.ReactNode> = {
  light: <Sun size={18} />,
  dark: <Moon size={18} />,
  system: <Monitor size={18} />,
};

export default function Header() {
  const { i18n, t } = useTranslation();
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const lang =
      LANGUAGES.find((l) => l.code === i18n.resolvedLanguage) ?? LANGUAGES[0];
    document.documentElement.dir = lang.dir;
    document.documentElement.lang = lang.code;
  }, [i18n.resolvedLanguage]);

  function handleOsChange(e: MediaQueryListEvent) {
    if (localStorage.getItem("theme")) return;
    document.documentElement.classList.toggle("dark", e.matches);
  }

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", handleOsChange);
    return () => mq.removeEventListener("change", handleOsChange);
  }, []);

  function selectTheme(mode: ThemeMode) {
    applyTheme(mode);
    setTheme(mode);
  }

  function handleLanguageChange(e: React.ChangeEvent<HTMLSelectElement>) {
    void i18n.changeLanguage(e.target.value);
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border">
      <a href="/" aria-label="Chisko" className="flex items-center gap-2.5">
        <img
          src="/logoMark.svg"
          alt=""
          aria-hidden="true"
          className="h-8 w-8"
        />
        <span className="text-xl font-bold tracking-tight">
          <span className="text-foreground">Chi</span>
          <span className="text-primary">sko</span>
        </span>
      </a>

      <div className="flex items-center gap-3">
        {/* Theme menu */}
        <Menu.Root>
          <Menu.Trigger
            aria-label={t("theme_menu_label")}
            className={cn(
              "flex items-center justify-center w-9 h-9 rounded-full",
              "text-muted-foreground hover:text-foreground hover:bg-muted",
              "transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring/50",
            )}
          >
            {CURRENT_ICON[theme]}
          </Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner side="bottom" align="end" sideOffset={6}>
              <Menu.Popup
                className={cn(
                  "min-w-[9rem] rounded-lg border border-border bg-popover p-1",
                  "shadow-md text-popover-foreground",
                  "origin-[var(--transform-origin)]",
                  "transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0",
                  "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
                )}
              >
                {THEME_OPTIONS.map(({ mode, icon, labelKey }) => (
                  <Menu.Item
                    key={mode}
                    onClick={() => selectTheme(mode)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm cursor-default",
                      "outline-none select-none",
                      "hover:bg-accent hover:text-accent-foreground",
                      "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground",
                    )}
                  >
                    <span className="text-muted-foreground">{icon}</span>
                    <span className="flex-1">{t(labelKey)}</span>
                    {theme === mode && (
                      <Check size={13} className="text-primary" />
                    )}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>

        {/* Language selector */}
        <select
          value={i18n.resolvedLanguage}
          onChange={handleLanguageChange}
          aria-label={t("language")}
          className={cn(
            "text-sm rounded-md border border-input bg-background px-2 py-1",
            "text-foreground outline-none",
            "focus:ring-2 focus:ring-ring/30 focus:border-ring",
            "transition-colors",
          )}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}
