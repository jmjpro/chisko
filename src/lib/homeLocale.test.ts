import { describe, it, expect } from "vitest";
import { homeByLocale } from "./homeLocale";
import heHome from "../../public/locales/he/home.json";
import enHome from "../../public/locales/en/home.json";
import arHome from "../../public/locales/ar/home.json";
import ruHome from "../../public/locales/ru/home.json";

describe("homeByLocale", () => {
  it("maps each supported locale to its own home.json content", () => {
    expect(homeByLocale.he).toEqual(heHome);
    expect(homeByLocale.en).toEqual(enHome);
    expect(homeByLocale.ar).toEqual(arHome);
    expect(homeByLocale.ru).toEqual(ruHome);
  });
});
