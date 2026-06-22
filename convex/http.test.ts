/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const DATA_GOV_URL =
  "https://data.gov.il/api/3/action/datastore_search?resource_id=e9701dcb-9f1c-43bb-bd44-eb380ade542f&limit=3000";

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

test("POST /seed on a non-production deployment skips the registry/places seed by default", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/seed", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret" },
  });

  expect(response.status).toBe(200);
  const body = await response.text();
  expect(body).toContain("seedRegistries=true");
  expect(body).toContain("10-50MB");

  const places = await t.run((ctx) => ctx.db.query("israelPlaces").collect());
  expect(places.length).toBe(0);
});

test("POST /seed on a non-production deployment with ?seedRegistries=true opts in", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/seed?seedRegistries=true", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret" },
  });

  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledWith(DATA_GOV_URL);
});

test("POST /seed on production always seeds the registry/places data", async () => {
  vi.stubEnv("SENTRY_ENVIRONMENT", "production");
  const t = convexTest(schema, modules);

  const response = await t.fetch("/seed", {
    method: "POST",
    headers: { Authorization: "Bearer test-secret" },
  });

  expect(response.status).toBe(200);
  expect(fetch).toHaveBeenCalledWith(DATA_GOV_URL);
});
