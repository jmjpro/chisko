import { describe, it, expect } from "vitest";
import { wizardByLocale } from "./wizardLocale";
import heWizard from "../../public/locales/he/wizard.json";
import enWizard from "../../public/locales/en/wizard.json";
import arWizard from "../../public/locales/ar/wizard.json";
import ruWizard from "../../public/locales/ru/wizard.json";

describe("wizardByLocale", () => {
  it("maps each supported locale to its own wizard.json content", () => {
    expect(wizardByLocale.he).toEqual(heWizard);
    expect(wizardByLocale.en).toEqual(enWizard);
    expect(wizardByLocale.ar).toEqual(arWizard);
    expect(wizardByLocale.ru).toEqual(ruWizard);
  });

  it("exposes a page_title for every locale", () => {
    expect(wizardByLocale.en.page_title).toBe("Wizard");
    expect(wizardByLocale.he.page_title).toBe("אשף");
    expect(wizardByLocale.ar.page_title).toBe("المعالج");
    expect(wizardByLocale.ru.page_title).toBe("Мастер");
  });
});
