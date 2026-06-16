import { describe, expect, it } from "vitest";
import { getConvexUrl } from "./getConvexUrl";

describe("getConvexUrl", () => {
  it("returns the URL when it is set", () => {
    expect(getConvexUrl("https://example.convex.cloud")).toBe(
      "https://example.convex.cloud",
    );
  });

  it("throws a clear error when the URL is missing", () => {
    expect(() => getConvexUrl(undefined)).toThrow(/VITE_CONVEX_URL/);
  });

  it("throws a clear error when the URL is empty", () => {
    expect(() => getConvexUrl("")).toThrow(/VITE_CONVEX_URL/);
  });
});
