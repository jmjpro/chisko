import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const getOrCreate = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_session_token", (q) =>
        q.eq("sessionToken", args.sessionToken),
      )
      .first();
    if (existing) return existing._id;
    return ctx.db.insert("sessions", {
      sessionToken: args.sessionToken,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      convertedToLeadId: null,
    });
  },
});
