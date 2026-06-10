import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    sessionId: v.id("sessions"),
    hasSmartMeter: v.union(
      v.literal("yes"),
      v.literal("no"),
      v.literal("unknown"),
    ),
    bundleMemberships: v.array(v.string()),
    city: v.string(),
    currentSupplierId: v.union(v.id("suppliers"), v.null()),
    currentPlanId: v.union(v.id("plans"), v.null()),
    approximateMonthlyKwh: v.union(v.number(), v.null()),
    workFromHome: v.union(
      v.literal("always"),
      v.literal("sometimes"),
      v.literal("never"),
    ),
    hasEv: v.boolean(),
    evChargingTime: v.union(
      v.literal("day"),
      v.literal("night"),
      v.literal("mixed"),
      v.null(),
    ),
    washerDryerTime: v.union(
      v.literal("day"),
      v.literal("night"),
      v.literal("flexible"),
      v.null(),
    ),
    acUsageLevel: v.union(
      v.literal("heavy"),
      v.literal("moderate"),
      v.literal("light"),
      v.literal("none"),
    ),
    willingToShiftUsage: v.boolean(),
  },
  handler: async (ctx, { sessionId, ...fields }) => {
    const existing = await ctx.db
      .query("homeProfiles")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first();
    if (existing) {
      await ctx.db.patch("homeProfiles", existing._id, fields);
      return existing._id;
    }
    return ctx.db.insert("homeProfiles", { sessionId, ...fields });
  },
});
