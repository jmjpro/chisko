"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { BATCH_SIZE } from "./smartMeterRegistry";

const IEC_CSV_URL =
  "https://minisites.howazit.com/5430101017/mobility_addresses.csv";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const doRefresh = internalAction({
  args: {},
  handler: async (ctx) => {
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

    const cities = Array.from(cityMap.entries()).map(
      ([cityCode, cityName]) => ({
        cityCode,
        cityName,
      }),
    );
    const streets = Array.from(streetMap.values());
    console.log(
      `${ts()} Parsed: ${cities.length} cities, ${streets.length} streets, ${addresses.length.toLocaleString()} addresses`,
    );

    // ── Clear existing data ──────────────────────────────────────────────────
    let deletedAddresses = 0;
    while (true) {
      const n: number = await ctx.runMutation(
        internal.smartMeterRegistry.deleteAddressBatch,
        {},
      );
      deletedAddresses += n;
      if (n === 0) break;
      if (deletedAddresses % 10000 === 0) {
        console.log(
          `${ts()}   Clearing addresses: ${deletedAddresses.toLocaleString()} deleted…`,
        );
      }
      await sleep(150);
    }
    if (deletedAddresses > 0)
      console.log(
        `${ts()}   Cleared ${deletedAddresses.toLocaleString()} addresses`,
      );

    let deletedStreets = 0;
    while (true) {
      const n: number = await ctx.runMutation(
        internal.smartMeterRegistry.deleteStreetBatch,
        {},
      );
      deletedStreets += n;
      if (n === 0) break;
      await sleep(150);
    }
    if (deletedStreets > 0)
      console.log(`${ts()}   Cleared ${deletedStreets} streets`);

    let deletedCities = 0;
    while (true) {
      const n: number = await ctx.runMutation(
        internal.smartMeterRegistry.deleteCityBatch,
        {},
      );
      deletedCities += n;
      if (n === 0) break;
      await sleep(150);
    }
    if (deletedCities > 0)
      console.log(`${ts()}   Cleared ${deletedCities} cities`);

    // ── Insert new data ──────────────────────────────────────────────────────
    console.log(`${ts()} Inserting ${cities.length} cities…`);
    for (let i = 0; i < cities.length; i += BATCH_SIZE) {
      await ctx.runMutation(internal.smartMeterRegistry.insertCitiesBatch, {
        rows: cities.slice(i, i + BATCH_SIZE),
      });
      await sleep(150);
    }

    console.log(`${ts()} Inserting ${streets.length} streets…`);
    for (let i = 0; i < streets.length; i += BATCH_SIZE) {
      await ctx.runMutation(internal.smartMeterRegistry.insertStreetsBatch, {
        rows: streets.slice(i, i + BATCH_SIZE),
      });
      await sleep(150);
    }

    const totalAddressBatches = Math.ceil(addresses.length / BATCH_SIZE);
    console.log(
      `${ts()} Inserting ${addresses.length.toLocaleString()} addresses (${totalAddressBatches} batches)…`,
    );
    for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
      await ctx.runMutation(internal.smartMeterRegistry.insertAddressesBatch, {
        rows: addresses.slice(i, i + BATCH_SIZE),
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
  },
});
