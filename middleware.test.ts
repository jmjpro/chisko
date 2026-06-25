import { describe, it, expect } from "vitest";
import middleware from "./middleware";

describe("middleware", () => {
  it("redirects to the locale prefix matching Accept-Language", () => {
    const request = new Request("https://chisko.example/", {
      headers: { "accept-language": "en" },
    });

    const response = middleware(request);

    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(
      "https://chisko.example/en/",
    );
  });

  it("prefers the chisko_lang cookie over Accept-Language", () => {
    const request = new Request("https://chisko.example/", {
      headers: {
        "accept-language": "en",
        cookie: "chisko_lang=ru",
      },
    });

    const response = middleware(request);

    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe(
      "https://chisko.example/ru/",
    );
  });

  it("does not redirect when there is no cookie or Accept-Language match", () => {
    const request = new Request("https://chisko.example/");

    const response = middleware(request);

    expect(response).toBeUndefined();
  });

  it("does not redirect a path already under a locale prefix", () => {
    const request = new Request("https://chisko.example/en/plans", {
      headers: { "accept-language": "ar" },
    });

    const response = middleware(request);

    expect(response).toBeUndefined();
  });

  it("does not redirect /r/ share paths", () => {
    const request = new Request("https://chisko.example/r/abc123", {
      headers: { "accept-language": "en" },
    });

    const response = middleware(request);

    expect(response).toBeUndefined();
  });

  it("does not redirect static asset paths", () => {
    const headers = { "accept-language": "en" };

    const favicon = middleware(
      new Request("https://chisko.example/favicon.svg", { headers }),
    );
    const chunk = middleware(
      new Request("https://chisko.example/_astro/chunk.js", { headers }),
    );

    expect(favicon).toBeUndefined();
    expect(chunk).toBeUndefined();
  });

  it("does not redirect Vite's internal dev-server paths, even when Accept-Language resolves to a non-default locale", () => {
    const headers = { "accept-language": "en" };

    const viteClient = middleware(
      new Request("https://chisko.example/@vite/client", { headers }),
    );
    const reactRefresh = middleware(
      new Request("https://chisko.example/@react-refresh", { headers }),
    );
    const viteId = middleware(
      new Request("https://chisko.example/@id/__x00__astro:toolbar:internal", {
        headers,
      }),
    );

    expect(viteClient).toBeUndefined();
    expect(reactRefresh).toBeUndefined();
    expect(viteId).toBeUndefined();
  });
});
