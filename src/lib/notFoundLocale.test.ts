import { describe, it, expect } from "vitest";
import { notFoundByLocale } from "./notFoundLocale";
import heNotFound from "../../public/locales/he/notFound.json";
import enNotFound from "../../public/locales/en/notFound.json";
import arNotFound from "../../public/locales/ar/notFound.json";
import ruNotFound from "../../public/locales/ru/notFound.json";

describe("notFoundByLocale", () => {
  it("maps each supported locale to its own notFound.json content", () => {
    expect(notFoundByLocale.he).toEqual(heNotFound);
    expect(notFoundByLocale.en).toEqual(enNotFound);
    expect(notFoundByLocale.ar).toEqual(arNotFound);
    expect(notFoundByLocale.ru).toEqual(ruNotFound);
  });
});
