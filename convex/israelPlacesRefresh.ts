import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import { BATCH_SIZE } from "./israelPlaces";
import { withCapturedExceptions } from "./lib/sentry";
import type { ActionCtx } from "./_generated/server";

const DATA_GOV_URL =
  "https://data.gov.il/api/3/action/datastore_search?resource_id=e9701dcb-9f1c-43bb-bd44-eb380ade542f&limit=3000";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Pages through `existingHeNames` to build an in-memory Set of names already
// in the table — see ADR 0021 and the equivalent helper in
// smartMeterRegistryRefresh.ts.
async function loadKeySet(
  ctx: ActionCtx,
  queryRef: FunctionReference<
    "query",
    "internal",
    { paginationOpts: { cursor: string | null; numItems: number } },
    { keys: string[]; isDone: boolean; continueCursor: string }
  >,
): Promise<Set<string>> {
  const keys = new Set<string>();
  let cursor: string | null = null;
  while (true) {
    const result: { keys: string[]; isDone: boolean; continueCursor: string } =
      await ctx.runQuery(queryRef, {
        paginationOpts: { cursor, numItems: 4096 },
      });
    for (const key of result.keys) keys.add(key);
    if (result.isDone) break;
    cursor = result.continueCursor;
  }
  return keys;
}

export const doRefresh = internalAction({
  args: {},
  handler: async (ctx) => withCapturedExceptions(() => runRefresh(ctx)),
});

async function runRefresh(ctx: ActionCtx) {
  const t0 = Date.now();
  const ts = () => `[+${((Date.now() - t0) / 1000).toFixed(1)}s]`;

  console.log(`${ts()} Fetching israel_places from data.gov.il…`);
  const response = await fetch(DATA_GOV_URL);
  if (!response.ok) {
    throw new Error(`israelPlaces fetch failed: HTTP ${response.status}`);
  }

  const json = (await response.json()) as {
    result: {
      records: {
        name_in_hebrew: string | null;
        name_in_english: string | null;
        name_in_arabic: string | null;
        name_in_russian: string | null;
      }[];
    };
  };

  const places = json.result.records
    .map((r) => ({
      he: r.name_in_hebrew?.trim() ?? "",
      en: r.name_in_english?.trim() || undefined,
      ar: r.name_in_arabic?.trim() || undefined,
      ru: r.name_in_russian?.trim() || undefined,
    }))
    .filter((p) => p.he);

  console.log(`${ts()} Fetched ${places.length} places`);

  // ── Insert new data (existing keys are skipped, never deleted — ADR 0021) ─
  const existingHeNames = await loadKeySet(
    ctx,
    internal.israelPlaces.existingHeNames,
  );
  const newPlaces: typeof places = [];
  for (const place of places) {
    if (existingHeNames.has(place.he)) continue;
    existingHeNames.add(place.he);
    newPlaces.push(place);
  }

  console.log(`${ts()} Inserting ${newPlaces.length} places…`);
  for (let i = 0; i < newPlaces.length; i += BATCH_SIZE) {
    await ctx.runMutation(internal.israelPlaces.insertBatch, {
      rows: newPlaces.slice(i, i + BATCH_SIZE),
    });
    await sleep(150);
  }

  console.log(`${ts()} Done.`);
}
