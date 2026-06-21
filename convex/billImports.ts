import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Active IEC TAOZ rate windows, needed by the client to bucket a smart-meter
 * CSV into the same season/peak buckets the server used to produce.
 */
export const getActiveIecTaozRates = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("iecTaozRates")
      .withIndex("by_effective_to", (q) => q.eq("effectiveTo", null))
      .collect();
    const effectiveFrom = rows[0]?.effectiveFrom ?? null;
    return { rows, effectiveFrom };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Records a smart-meter CSV bill import from client-computed aggregates.
 * The CSV itself is parsed entirely in the browser (convex/lib/smartMeterCsvParser.ts)
 * and never uploaded — only these 8 aggregate numbers are sent here. See ADR 0015.
 */
export const submitSmartMeterCsv = mutation({
  args: {
    sessionId: v.id("sessions"),
    billingPeriodStart: v.number(),
    billingPeriodEnd: v.number(),
    totalKwh: v.number(),
    kwhWeekdayDay: v.number(),
    kwhWeekdayNight: v.number(),
    kwhWeekendDay: v.number(),
    kwhWeekendNight: v.number(),
    kwhTaozSummerPeak: v.number(),
    kwhTaozSummerOffPeak: v.number(),
    kwhTaozWinterPeak: v.number(),
    kwhTaozWinterOffPeak: v.number(),
    iecTaozRatesEffectiveFrom: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("sessions", args.sessionId);
    if (!session) throw new Error("Session not found");

    return ctx.db.insert("billImports", {
      sessionId: args.sessionId,
      inputMode: "smartmeterCsv",
      billingPeriodStart: args.billingPeriodStart,
      billingPeriodEnd: args.billingPeriodEnd,
      totalKwh: args.totalKwh,
      currentSupplierId: null,
      currentPlanVersionId: null,
      kwhWeekdayDay: args.kwhWeekdayDay,
      kwhWeekdayNight: args.kwhWeekdayNight,
      kwhWeekendDay: args.kwhWeekendDay,
      kwhWeekendNight: args.kwhWeekendNight,
      kwhTaozSummerPeak: args.kwhTaozSummerPeak,
      kwhTaozSummerOffPeak: args.kwhTaozSummerOffPeak,
      kwhTaozWinterPeak: args.kwhTaozWinterPeak,
      kwhTaozWinterOffPeak: args.kwhTaozWinterOffPeak,
      ...(args.iecTaozRatesEffectiveFrom !== undefined
        ? { iecTaozRatesEffectiveFrom: args.iecTaozRatesEffectiveFrom }
        : {}),
      rawFileStorageId: null,
      rawFileDeletedAt: null,
      parsedDataStorageId: null,
      userConfirmed: null,
      editedFieldCount: null,
      confirmedAt: null,
    });
  },
});
