import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const BATCH_SIZE = 2000;

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
      .withIndex("by_city_and_street", (q) =>
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

// ── Internal mutations (called by the refresh action) ────────────────────────

export const deleteAddressBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("smartMeterAddresses").take(BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete("smartMeterAddresses", row._id);
    }
    return rows.length;
  },
});

export const deleteStreetBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("smartMeterStreets").take(BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete("smartMeterStreets", row._id);
    }
    return rows.length;
  },
});

export const deleteCityBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("smartMeterCities").take(BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete("smartMeterCities", row._id);
    }
    return rows.length;
  },
});

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
  args: { lastRefreshedAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("smartMeterRegistryMeta").first();
    if (existing) {
      await ctx.db.patch("smartMeterRegistryMeta", existing._id, {
        lastRefreshedAt: args.lastRefreshedAt,
      });
    } else {
      await ctx.db.insert("smartMeterRegistryMeta", {
        lastRefreshedAt: args.lastRefreshedAt,
      });
    }
  },
});
