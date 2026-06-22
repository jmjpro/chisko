import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const BATCH_SIZE = 2000;

export const hasData = internalQuery({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("israelPlaces").first()) !== null;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("israelPlaces").take(2000);
    return rows.sort((a, b) => (a.he < b.he ? -1 : 1));
  },
});

// Existing-key lookup for the refresh action's in-memory dedup — see ADR 0021
// and the equivalent comment in smartMeterRegistry.ts.
export const existingHeNames = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("israelPlaces")
      .paginate(args.paginationOpts);
    return {
      keys: result.page.map((r) => r.he),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

// Insert-only: the action has already filtered out places that exist (see
// above), so this is a plain batch insert (see ADR 0021).
export const insertBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({
        he: v.string(),
        en: v.optional(v.string()),
        ar: v.optional(v.string()),
        ru: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert("israelPlaces", row);
    }
  },
});
