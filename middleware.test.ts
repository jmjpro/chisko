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

  it("rewrites an unmatched path under a locale prefix to that locale's 404 page", () => {
    const request = new Request("https://chisko.example/en/does-not-exist");

    const response = middleware(request);

    expect(response?.headers.get("x-middleware-rewrite")).toBe(
      "https://chisko.example/en/404",
    );
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
});
