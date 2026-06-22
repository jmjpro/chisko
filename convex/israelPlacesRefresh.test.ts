/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test, vi, beforeEach, afterEach } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

const DATA_GOV_URL =
  "https://data.gov.il/api/3/action/datastore_search?resource_id=e9701dcb-9f1c-43bb-bd44-eb380ade542f&limit=3000";

type PlaceRecord = {
  name_in_hebrew: string | null;
  name_in_english: string | null;
  name_in_arabic: string | null;
  name_in_russian: string | null;
};

function stubPlacesFetch(records: PlaceRecord[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url === DATA_GOV_URL)
        return Promise.resolve({
          ok: true,
          json: async () => ({ result: { records } }),
        });
      return Promise.resolve({ ok: true });
    }),
  );
}

beforeEach(() => {
  vi.stubEnv(
    "SENTRY_DSN_BE",
    "https://publickey123@o123.ingest.de.sentry.io/456",
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("doRefresh never deletes a place dropped from a later fetch, and never duplicates one still present", async () => {
  const t = convexTest(schema, modules);

  stubPlacesFetch([
    {
      name_in_hebrew: "תל אביב",
      name_in_english: "Tel Aviv",
      name_in_arabic: null,
      name_in_russian: null,
    },
    {
      name_in_hebrew: "חיפה",
      name_in_english: "Haifa",
      name_in_arabic: null,
      name_in_russian: null,
    },
  ]);
  await t.action(internal.israelPlacesRefresh.doRefresh, {});

  // Second fetch drops Haifa but keeps Tel Aviv — neither should change the
  // live result: Tel Aviv must not duplicate, Haifa must not disappear.
  stubPlacesFetch([
    {
      name_in_hebrew: "תל אביב",
      name_in_english: "Tel Aviv",
      name_in_arabic: null,
      name_in_russian: null,
    },
  ]);
  await t.action(internal.israelPlacesRefresh.doRefresh, {});

  const places = await t.query(api.israelPlaces.getAll, {});
  expect(places).toMatchObject(
    expect.arrayContaining([
      expect.objectContaining({ he: "תל אביב", en: "Tel Aviv" }),
      expect.objectContaining({ he: "חיפה", en: "Haifa" }),
    ]),
  );
  expect(places).toHaveLength(2);
});
