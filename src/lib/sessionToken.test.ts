import { describe, expect, it, vi } from "vitest";
import { generateSessionToken } from "./sessionToken";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateSessionToken", () => {
  it("returns a v4 UUID string", () => {
    expect(generateSessionToken()).toMatch(UUID_RE);
  });

  it("returns a different value on each call", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it("works when randomUUID is unavailable (non-secure context)", () => {
    const spy = vi
      .spyOn(crypto, "randomUUID")
      // @ts-expect-error simulate non-secure context where randomUUID is absent
      .mockImplementation(undefined);
    try {
      expect(generateSessionToken()).toMatch(UUID_RE);
    } finally {
      spy.mockRestore();
    }
  });
});
