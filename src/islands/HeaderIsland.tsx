import { useEffect } from "react";
import Header from "../components/header";
import i18n from "../i18n";

interface Props {
  locale: string;
  langSwitchUrls: Record<string, string>;
}

export default function HeaderIsland({ locale, langSwitchUrls }: Props) {
  useEffect(() => {
    void i18n.changeLanguage(locale);
  }, [locale]);

  return <Header langSwitchUrls={langSwitchUrls} />;
}
