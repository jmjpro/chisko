import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const BATCH_SIZE = 2000;

export const hasData = internalQuery({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("smartMeterCities").first()) !== null;
  },
});

// ── Public queries (used by the cascading address picker) ────────────────────

export const getCities = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("smartMeterCities").take(1500);
    return rows.sort((a, b) => (a.cityName < b.cityName ? -1 : 1));
  },
});

export const getStreets = query({
  args: { cityCode: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("smartMeterStreets")
      .withIndex("by_city_code", (q) => q.eq("cityCode", args.cityCode))
      .take(2000);
    return rows.sort((a, b) => (a.streetName < b.streetName ? -1 : 1));
  },
});

export const getHouseNumbers = query({
  args: { cityCode: v.number(), streetCode: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("smartMeterAddresses")
      .withIndex("by_city_street_and_house", (q) =>
        q.eq("cityCode", args.cityCode).eq("streetCode", args.streetCode),
      )
      .take(500);
    return rows
      .map((r) => r.houseNumber)
      .sort((a, b) => {
        const na = parseInt(a, 10) || 0;
        const nb = parseInt(b, 10) || 0;
        return na !== nb ? na - nb : a < b ? -1 : 1;
      });
  },
});

export const checkAddress = query({
  args: {
    cityCode: v.number(),
    streetCode: v.number(),
    houseNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("smartMeterAddresses")
      .withIndex("by_city_street_and_house", (q) =>
        q
          .eq("cityCode", args.cityCode)
          .eq("streetCode", args.streetCode)
          .eq("houseNumber", args.houseNumber),
      )
      .first();
    return row !== null;
  },
});

export const getMeta = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("smartMeterRegistryMeta").first();
  },
});

// ── Internal queries (existing-key lookup for the refresh action's in-memory
// dedup — see ADR 0021) ────────────────────────────────────────────────────
// The refresh action pages through these once per run to build a Set of
// existing keys, then filters new rows against it in memory. This avoids an
// indexed point-query per CSV row, which (at ~400k+ address rows) was slow
// enough to blow past the Convex HTTP action time limit on a fresh seed.

export const existingCityCodes = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("smartMeterCities")
      .paginate(args.paginationOpts);
    return {
      keys: result.page.map((r) => r.cityCode),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const existingStreetKeys = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("smartMeterStreets")
      .paginate(args.paginationOpts);
    return {
      keys: result.page.map((r) => `${r.cityCode}:${r.streetCode}`),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

export const existingAddressKeys = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("smartMeterAddresses")
      .paginate(args.paginationOpts);
    return {
      keys: result.page.map(
        (r) => `${r.cityCode}:${r.streetCode}:${r.houseNumber}`,
      ),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// ── Internal mutations (called by the refresh action) ────────────────────────
// Insert-only: the action has already filtered out rows that exist (see
// above), so these are plain batch inserts (see ADR 0021).

export const insertCitiesBatch = internalMutation({
  args: {
    rows: v.array(v.object({ cityCode: v.number(), cityName: v.string() })),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("smartMeterCities", row);
    }
  },
});

export const insertStreetsBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        cityCode: v.number(),
        streetCode: v.number(),
        streetName: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("smartMeterStreets", row);
    }
  },
});

export const insertAddressesBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        cityCode: v.number(),
        streetCode: v.number(),
        houseNumber: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("smartMeterAddresses", row);
    }
  },
});

export const upsertMeta = internalMutation({
  args: {
    lastRefreshedAt: v.optional(v.number()),
    sourceETag: v.optional(v.string()),
    lastCheckedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("smartMeterRegistryMeta").first();
    if (existing) {
      await ctx.db.patch("smartMeterRegistryMeta", existing._id, args);
    } else {
      await ctx.db.insert("smartMeterRegistryMeta", {
        lastRefreshedAt: args.lastRefreshedAt ?? Date.now(),
        ...(args.sourceETag !== undefined && { sourceETag: args.sourceETag }),
        ...(args.lastCheckedAt !== undefined && {
          lastCheckedAt: args.lastCheckedAt,
        }),
      });
    }
  },
});
