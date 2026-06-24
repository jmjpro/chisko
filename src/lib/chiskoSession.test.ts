import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSessionStore } from "./chiskoSession";

vi.mock("./sessionToken", () => ({
  getOrCreateSessionToken: () => "tok",
}));

describe("createSessionStore", () => {
  let mutation: ReturnType<typeof vi.fn>;
  let client: { mutation: typeof mutation };

  beforeEach(() => {
    mutation = vi.fn().mockResolvedValue("session1");
    client = { mutation };
  });

  it("calls sessions.getOrCreate with the shared token on first use", async () => {
    const store = createSessionStore();

    const sessionId = await store.getOrCreate(client);

    expect(sessionId).toBe("session1");
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(mutation).toHaveBeenCalledWith(expect.anything(), {
      sessionToken: "tok",
    });
  });

  it("memoizes across multiple independent callers (e.g. one per plans-page row)", async () => {
    const store = createSessionStore();

    const [a, b, c] = await Promise.all([
      store.getOrCreate(client),
      store.getOrCreate(client),
      store.getOrCreate(client),
    ]);

    expect(a).toBe("session1");
    expect(b).toBe("session1");
    expect(c).toBe("session1");
    expect(mutation).toHaveBeenCalledTimes(1);
  });

  it("does not share state across separate store instances", async () => {
    const storeA = createSessionStore();
    const storeB = createSessionStore();

    await storeA.getOrCreate(client);
    await storeB.getOrCreate(client);

    expect(mutation).toHaveBeenCalledTimes(2);
  });
});
