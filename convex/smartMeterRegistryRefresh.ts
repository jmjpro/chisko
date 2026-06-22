"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import { BATCH_SIZE } from "./smartMeterRegistry";
import { withCapturedExceptions } from "./lib/sentry";
import type { ActionCtx } from "./_generated/server";

const IEC_CSV_URL =
  "https://minisites.howazit.com/5430101017/mobility_addresses.csv";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// Pages through one of the `existing*Keys` queries to build an in-memory Set
// of keys already in the table — see ADR 0021.
async function loadKeySet<T>(
  ctx: ActionCtx,
  queryRef: FunctionReference<
    "query",
    "internal",
    { paginationOpts: { cursor: string | null; numItems: number } },
    { keys: T[]; isDone: boolean; continueCursor: string }
  >,
): Promise<Set<T>> {
  const keys = new Set<T>();
  let cursor: string | null = null;
  while (true) {
    const result: { keys: T[]; isDone: boolean; continueCursor: string } =
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

  console.log(`${ts()} Fetching CSV…`);
  const response = await fetch(IEC_CSV_URL);
  if (!response.ok) {
    throw new Error(
      `Smart Meter Registry fetch failed: HTTP ${response.status}`,
    );
  }

  const buffer = await response.arrayBuffer();
  console.log(
    `${ts()} Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB — decoding…`,
  );
  const decoder = new TextDecoder("windows-1255");
  const text = decoder.decode(buffer);

  // Line 1: date header ("מעודכן לתאריך …"), Line 2: column header
  const lines = text.split("\n").slice(2);
  console.log(`${ts()} Parsing ${lines.length.toLocaleString()} lines…`);

  const cityMap = new Map<number, string>();
  const streetMap = new Map<
    string,
    { cityCode: number; streetCode: number; streetName: string }
  >();
  const addresses: {
    cityCode: number;
    streetCode: number;
    houseNumber: string;
  }[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(";");
    if (parts.length < 5) continue;

    const cityName = parts[0].trim();
    const streetName = parts[1].trim();
    const houseNumber = parts[2].trim();
    const cityCode = parseInt(parts[3], 10);
    const streetCode = parseInt(parts[4], 10);

    if (!cityName || !streetName || isNaN(cityCode) || isNaN(streetCode))
      continue;

    cityMap.set(cityCode, cityName);

    const streetKey = `${cityCode}:${streetCode}`;
    if (!streetMap.has(streetKey)) {
      streetMap.set(streetKey, { cityCode, streetCode, streetName });
    }

    addresses.push({ cityCode, streetCode, houseNumber });
  }

  const cities = Array.from(cityMap.entries()).map(([cityCode, cityName]) => ({
    cityCode,
    cityName,
  }));
  const streets = Array.from(streetMap.values());
  console.log(
    `${ts()} Parsed: ${cities.length} cities, ${streets.length} streets, ${addresses.length.toLocaleString()} addresses`,
  );

  // ── Insert new data (existing keys are skipped, never deleted — ADR 0021) ─
  const existingCityCodes = await loadKeySet(
    ctx,
    internal.smartMeterRegistry.existingCityCodes,
  );
  const newCities = cities.filter((c) => !existingCityCodes.has(c.cityCode));
  console.log(`${ts()} Inserting ${newCities.length} cities…`);
  for (let i = 0; i < newCities.length; i += BATCH_SIZE) {
    await ctx.runMutation(internal.smartMeterRegistry.insertCitiesBatch, {
      rows: newCities.slice(i, i + BATCH_SIZE),
    });
    await sleep(150);
  }

  const existingStreetKeys = await loadKeySet(
    ctx,
    internal.smartMeterRegistry.existingStreetKeys,
  );
  const newStreets = streets.filter(
    (s) => !existingStreetKeys.has(`${s.cityCode}:${s.streetCode}`),
  );
  console.log(`${ts()} Inserting ${newStreets.length} streets…`);
  for (let i = 0; i < newStreets.length; i += BATCH_SIZE) {
    await ctx.runMutation(internal.smartMeterRegistry.insertStreetsBatch, {
      rows: newStreets.slice(i, i + BATCH_SIZE),
    });
    await sleep(150);
  }

  // Addresses aren't deduped while parsing the CSV, so the existing-keys Set
  // also absorbs duplicate rows within this run as they're selected.
  const existingAddressKeys = await loadKeySet(
    ctx,
    internal.smartMeterRegistry.existingAddressKeys,
  );
  const newAddresses: typeof addresses = [];
  for (const addr of addresses) {
    const key = `${addr.cityCode}:${addr.streetCode}:${addr.houseNumber}`;
    if (existingAddressKeys.has(key)) continue;
    existingAddressKeys.add(key);
    newAddresses.push(addr);
  }

  const totalAddressBatches = Math.ceil(newAddresses.length / BATCH_SIZE);
  console.log(
    `${ts()} Inserting ${newAddresses.length.toLocaleString()} addresses (${totalAddressBatches} batches)…`,
  );
  for (let i = 0; i < newAddresses.length; i += BATCH_SIZE) {
    await ctx.runMutation(internal.smartMeterRegistry.insertAddressesBatch, {
      rows: newAddresses.slice(i, i + BATCH_SIZE),
    });
    await sleep(150);
    const batch = Math.floor(i / BATCH_SIZE) + 1;
    if (batch % 25 === 0) {
      const pct = Math.round((batch / totalAddressBatches) * 100);
      console.log(
        `${ts()}   Addresses: ${pct}% (${batch}/${totalAddressBatches} batches)`,
      );
    }
  }

  await ctx.runMutation(internal.smartMeterRegistry.upsertMeta, {
    lastRefreshedAt: Date.now(),
  });
  console.log(`${ts()} Done.`);
}
