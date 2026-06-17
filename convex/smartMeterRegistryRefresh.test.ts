/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { internal } from "./_generated/api";
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
