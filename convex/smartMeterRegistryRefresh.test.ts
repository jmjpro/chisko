/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const IEC_CSV_URL =
  "https://minisites.howazit.com/5430101017/mobility_addresses.csv";

beforeEach(() => {
  vi.stubEnv(
    "SENTRY_DSN_BE",
    "https://publickey123@o123.ingest.de.sentry.io/456",
  );
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === IEC_CSV_URL)
        return Promise.resolve({ ok: false, status: 503 });
      return Promise.resolve({ ok: true });
    }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("doRefresh reports the failure to Sentry and still rethrows", async () => {
  const t = convexTest(schema, modules);

  await expect(
    t.action(internal.smartMeterRegistryRefresh.doRefresh, {}),
  ).rejects.toThrow("Smart Meter Registry fetch failed: HTTP 503");

  const sentryCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find(
    ([url]) => url === "https://o123.ingest.de.sentry.io/api/456/store/",
  );
  expect(sentryCall).toBeDefined();
});

test("doRefresh no-ops when ENABLE_CONVEX_CLOUD is false", async () => {
  const t = convexTest(schema, modules);
  vi.stubEnv("ENABLE_CONVEX_CLOUD", "false");

  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  expect(fetch).not.toHaveBeenCalled();
});

function makeHeaders(etag?: string | null) {
  return {
    get: (name: string) =>
      name.toLowerCase() === "etag" ? (etag ?? null) : null,
  };
}

function stubCsvFetch(csvLines: string[], etag?: string | null) {
  const csv = ["date header", "column header", ...csvLines].join("\n");
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === IEC_CSV_URL && method === "HEAD") {
        return Promise.resolve({ ok: true, headers: makeHeaders(etag) });
      }
      if (url === IEC_CSV_URL) {
        return Promise.resolve({
          ok: true,
          headers: makeHeaders(etag),
          arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
        });
      }
      return Promise.resolve({ ok: true });
    }),
  );
}

function stubHeadOnly(etag: string | null) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === IEC_CSV_URL && method === "HEAD") {
        return Promise.resolve({ ok: true, headers: makeHeaders(etag) });
      }
      // A GET to IEC_CSV_URL should NOT happen — return something that would
      // clearly fail if the action tries to process it.
      return Promise.resolve({ ok: true });
    }),
  );
}

test("doRefresh skips CSV download when HEAD ETag matches stored ETag", async () => {
  const t = convexTest(schema, modules);

  // Seed meta with a known ETag so the action has something to compare against
  await t.run(async (ctx) => {
    await ctx.db.insert("smartMeterRegistryMeta", {
      lastRefreshedAt: 1000,
      sourceETag: '"v1"',
      lastCheckedAt: 1000,
    });
  });

  stubHeadOnly('"v1"');

  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  const fetchMock = fetch as ReturnType<typeof vi.fn>;
  const getCalls = fetchMock.mock.calls.filter(
    (call: any[]) =>
      call[0] === IEC_CSV_URL &&
      (call[1]?.method ?? "GET").toUpperCase() === "GET",
  );
  expect(getCalls).toHaveLength(0);
});

test("doRefresh updates lastCheckedAt but not lastRefreshedAt on ETag match", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    await ctx.db.insert("smartMeterRegistryMeta", {
      lastRefreshedAt: 1000,
      sourceETag: '"v1"',
      lastCheckedAt: 1000,
    });
  });

  stubHeadOnly('"v1"');

  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  const meta = await t.query(api.smartMeterRegistry.getMeta, {});
  expect(meta?.lastRefreshedAt).toBe(1000);
  expect(meta?.lastCheckedAt).toBeGreaterThan(1000);
});

test("doRefresh runs full refresh and stores ETag when HEAD ETag differs from stored", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    await ctx.db.insert("smartMeterRegistryMeta", {
      lastRefreshedAt: 1000,
      sourceETag: '"old"',
      lastCheckedAt: 1000,
    });
  });

  stubCsvFetch(["TelAviv;Rothschild;1;5000;100"], '"new"');

  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  const meta = await t.query(api.smartMeterRegistry.getMeta, {});
  expect(meta?.sourceETag).toBe('"new"');
  expect(meta?.lastRefreshedAt).toBeGreaterThan(1000);
});

test("doRefresh runs full refresh when no ETag is stored", async () => {
  const t = convexTest(schema, modules);

  stubCsvFetch(["TelAviv;Rothschild;1;5000;100"], '"v1"');

  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  const meta = await t.query(api.smartMeterRegistry.getMeta, {});
  expect(meta?.sourceETag).toBe('"v1"');
});

test("doRefresh runs full refresh when HEAD returns no ETag", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    await ctx.db.insert("smartMeterRegistryMeta", {
      lastRefreshedAt: 1000,
      sourceETag: '"v1"',
      lastCheckedAt: 1000,
    });
  });

  stubCsvFetch(["TelAviv;Rothschild;1;5000;100"], null);

  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  const fetchMock = fetch as ReturnType<typeof vi.fn>;
  const getCalls = fetchMock.mock.calls.filter(
    (call: any[]) =>
      call[0] === IEC_CSV_URL &&
      (call[1]?.method ?? "GET").toUpperCase() === "GET",
  );
  expect(getCalls.length).toBeGreaterThan(0);
});

test("doRefresh never deletes an address dropped from a later fetch, and never duplicates one still present", async () => {
  const t = convexTest(schema, modules);

  stubCsvFetch([
    "TelAviv;Rothschild;1;5000;100",
    "TelAviv;Rothschild;2;5000;100",
  ]);
  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  // Second fetch drops house "2" but keeps house "1" — neither should change
  // the live result: "1" must not duplicate, "2" must not disappear.
  stubCsvFetch(["TelAviv;Rothschild;1;5000;100"]);
  await t.action(internal.smartMeterRegistryRefresh.doRefresh, {});

  const houseNumbers = await t.query(api.smartMeterRegistry.getHouseNumbers, {
    cityCode: 5000,
    streetCode: 100,
  });
  expect(houseNumbers).toEqual(["1", "2"]);

  const cities = await t.query(api.smartMeterRegistry.getCities, {});
  expect(cities).toMatchObject([{ cityCode: 5000, cityName: "TelAviv" }]);
});
