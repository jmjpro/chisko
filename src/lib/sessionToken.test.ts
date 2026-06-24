import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateSessionToken, getOrCreateSessionToken } from "./sessionToken";

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

describe("getOrCreateSessionToken", () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates and persists a new token when none exists", () => {
    const token = getOrCreateSessionToken();

    expect(token).toMatch(UUID_RE);
    expect(store.get("ec2-session-token")).toBe(token);
  });

  it("returns the existing token on subsequent calls, across pages", () => {
    const first = getOrCreateSessionToken();
    const second = getOrCreateSessionToken();

    expect(second).toBe(first);
  });
});
