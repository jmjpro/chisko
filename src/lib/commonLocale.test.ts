import { describe, it, expect } from "vitest";
import { commonByLocale } from "./commonLocale";
import heCommon from "../../public/locales/he/common.json";
import enCommon from "../../public/locales/en/common.json";
import arCommon from "../../public/locales/ar/common.json";
import ruCommon from "../../public/locales/ru/common.json";

describe("commonByLocale", () => {
  it("maps each supported locale to its own common.json content", () => {
    expect(commonByLocale.he).toEqual(heCommon);
    expect(commonByLocale.en).toEqual(enCommon);
    expect(commonByLocale.ar).toEqual(arCommon);
    expect(commonByLocale.ru).toEqual(ruCommon);
  });
});
