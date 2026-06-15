import { describe, expect, it } from "vitest";
import { rewriteStorageUrl } from "./rewriteStorageUrl";

describe("rewriteStorageUrl", () => {
  it("replaces 127.0.0.1 hostname with the hostname from convexUrl", () => {
    expect(
      rewriteStorageUrl(
        "http://127.0.0.1:3211/api/storage/upload/abc123",
        "http://192.168.1.5:3210",
      ),
    ).toBe("http://192.168.1.5:3211/api/storage/upload/abc123");
  });

  it("is a no-op when convexUrl is also on 127.0.0.1", () => {
    const url = "http://127.0.0.1:3211/api/storage/upload/abc123";
    expect(rewriteStorageUrl(url, "http://127.0.0.1:3210")).toBe(url);
  });

  it("is a no-op when convexUrl is localhost", () => {
    const url = "http://127.0.0.1:3211/api/storage/upload/abc123";
    expect(rewriteStorageUrl(url, "http://localhost:3210")).toBe(url);
  });

  it("is a no-op when upload URL is not on 127.0.0.1 (production)", () => {
    const url =
      "https://example-backend.convex.cloud/api/storage/upload/abc123";
    expect(rewriteStorageUrl(url, "http://192.168.1.5:3210")).toBe(url);
  });

  it("returns the original URL when convexUrl is undefined", () => {
    const url = "http://127.0.0.1:3211/api/storage/upload/abc123";
    expect(rewriteStorageUrl(url, undefined)).toBe(url);
  });
});
