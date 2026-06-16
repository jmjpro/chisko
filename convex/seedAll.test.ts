/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const IEC_CSV_URL =
  "https://minisites.howazit.com/5430101017/mobility_addresses.csv";
const DATA_GOV_URL =
  "https://data.gov.il/api/3/action/datastore_search?resource_id=e9701dcb-9f1c-43bb-bd44-eb380ade542f&limit=3000";

function fakeFetch(url: string) {
  if (url === IEC_CSV_URL) {
    const csv = "header line\ncolumn header\n" + "Tel Aviv;Herzl;12;5000;100\n";
    return Promise.resolve({
      ok: true,
      arrayBuffer: async () => new TextEncoder().encode(csv).buffer,
    });
  }
  if (url === DATA_GOV_URL) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        result: {
          records: [
            {
              name_in_hebrew: "תל אביב",
              name_in_english: "Tel Aviv",
              name_in_arabic: null,
              name_in_russian: null,
            },
          ],
        },
      }),
    });
  }
  throw new Error(`Unexpected fetch URL: ${url}`);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("runAll seeds catalog data and refreshes empty registry/places tables", async () => {
  const t = convexTest(schema, modules);

  await t.action(internal.internal.seedAll.runAll, {});

  const suppliers = await t.run((ctx) => ctx.db.query("suppliers").collect());
  expect(suppliers.length).toBeGreaterThan(0);

  const cities = await t.run((ctx) =>
    ctx.db.query("smartMeterCities").collect(),
  );
  expect(cities.length).toBeGreaterThan(0);

  const places = await t.run((ctx) => ctx.db.query("israelPlaces").collect());
  expect(places.length).toBeGreaterThan(0);

  expect(fetch).toHaveBeenCalledWith(IEC_CSV_URL);
  expect(fetch).toHaveBeenCalledWith(DATA_GOV_URL);
});

test("runAll skips refreshing registry/places tables that are already populated", async () => {
  const t = convexTest(schema, modules);

  await t.run(async (ctx) => {
    await ctx.db.insert("smartMeterCities", {
      cityCode: 1,
      cityName: "Existing City",
    });
    await ctx.db.insert("israelPlaces", { he: "קיים" });
  });

  await t.action(internal.internal.seedAll.runAll, {});

  expect(fetch).not.toHaveBeenCalledWith(IEC_CSV_URL);
  expect(fetch).not.toHaveBeenCalledWith(DATA_GOV_URL);

  const suppliers = await t.run((ctx) => ctx.db.query("suppliers").collect());
  expect(suppliers.length).toBeGreaterThan(0);
});
