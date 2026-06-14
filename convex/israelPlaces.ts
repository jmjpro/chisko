import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";

export const BATCH_SIZE = 2000;

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("israelPlaces").take(2000);
    return rows.sort((a, b) => (a.he < b.he ? -1 : 1));
  },
});

export const deleteBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("israelPlaces").take(BATCH_SIZE);
    for (const row of rows) {
      await ctx.db.delete("israelPlaces", row._id);
    }
    return rows.length;
  },
});

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
