import { describe, it, expect, vi } from "vitest";

vi.mock("i18next-browser-languagedetector", () => ({
  default: {
    type: "languageDetector" as const,
    async: false,
    detect: vi.fn(() => "he"),
    init: vi.fn(),
    cacheUserLanguage: vi.fn(),
  },
}));

vi.mock("i18next-http-backend", () => ({
  default: {
    type: "backend" as const,
    init: vi.fn(),
    read: vi.fn(
      (
        _language: string,
        _namespace: string,
        callback: (err: null, data: Record<string, string>) => void,
      ) => callback(null, {}),
    ),
  },
}));

describe("i18n configuration", () => {
  it("falls back to Hebrew, not English", async () => {
    const { default: i18n } = await import("./i18n");
    expect(i18n.options.fallbackLng).toEqual(["he"]);
  });
});
