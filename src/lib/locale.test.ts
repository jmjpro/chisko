import { describe, it, expect } from "vitest";
import {
  parseAcceptLanguage,
  localeStaticPaths,
  buildLangSwitchUrls,
} from "./locale";

describe("parseAcceptLanguage", () => {
  it("returns 'he' when header is null", () => {
    expect(parseAcceptLanguage(null)).toBe("he");
  });

  it("returns 'he' for an empty string", () => {
    expect(parseAcceptLanguage("")).toBe("he");
  });

  it("detects English", () => {
    expect(parseAcceptLanguage("en")).toBe("en");
  });

  it("detects Arabic", () => {
    expect(parseAcceptLanguage("ar")).toBe("ar");
  });

  it("detects Russian", () => {
    expect(parseAcceptLanguage("ru")).toBe("ru");
  });

  it("strips region subtag (en-US → en)", () => {
    expect(parseAcceptLanguage("en-US")).toBe("en");
  });

  it("respects quality weights — picks highest-q supported locale", () => {
    expect(parseAcceptLanguage("fr;q=0.9,en;q=0.8")).toBe("en");
  });

  it("falls back to Hebrew for unsupported locales", () => {
    expect(parseAcceptLanguage("fr,de")).toBe("he");
  });

  it("parses a realistic Chrome Accept-Language header", () => {
    expect(parseAcceptLanguage("en-US,en;q=0.9")).toBe("en");
  });

  it("parses a realistic Chrome Accept-Language header for Arabic", () => {
    expect(parseAcceptLanguage("ar-SA,ar;q=0.9,en;q=0.8")).toBe("ar");
  });
});

describe("localeStaticPaths", () => {
  it("returns one params entry per prefixed locale", () => {
    expect(localeStaticPaths()).toEqual([
      { params: { locale: "en" } },
      { params: { locale: "ar" } },
      { params: { locale: "ru" } },
    ]);
  });
});

describe("buildLangSwitchUrls", () => {
  it("maps each locale to the path, with 'he' unprefixed and others locale-prefixed", () => {
    expect(buildLangSwitchUrls("/plans")).toEqual({
      he: "/plans",
      en: "/en/plans",
      ar: "/ar/plans",
      ru: "/ru/plans",
    });
  });

  it("treats the home path '/' as a special case (no double slash)", () => {
    expect(buildLangSwitchUrls("/")).toEqual({
      he: "/",
      en: "/en/",
      ar: "/ar/",
      ru: "/ru/",
    });
  });
});
