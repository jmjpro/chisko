/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.stubEnv("SEED_SECRET", "test-secret");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(0),
      json: async () => ({ result: { records: [] } }),
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("POST /seed without the correct secret is rejected", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/seed", {
    method: "POST",
    headers: { Authorization: "Bearer wrong-secret" },
  });

  expect(response.status).toBe(401);
  const suppliers = await t.run((ctx) => ctx.db.query("suppliers").collect());
  expect(suppliers.length).toBe(0);
});

test("POST /seed with the correct secret triggers seeding", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/seed", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret" },
  });

  expect(response.status).toBe(200);
  const suppliers = await t.run((ctx) => ctx.db.query("suppliers").collect());
  expect(suppliers.length).toBeGreaterThan(0);
});
