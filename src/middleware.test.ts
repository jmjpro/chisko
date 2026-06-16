import { describe, it, expect, vi } from "vitest";

vi.mock("astro:middleware", () => ({
  defineMiddleware: (fn: unknown) => fn,
}));

import { parseAcceptLanguage } from "./middleware";

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
