import {
  action,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { withCapturedExceptions } from "./lib/sentry";
import type { ActionCtx } from "./_generated/server";
import { parseSmartMeterCsvText } from "./lib/smartMeterCsvParser";

// ─────────────────────────────────────────────────────────────────────────────
// Public mutations
// ─────────────────────────────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

export const sessionExists = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) =>
    !!(await ctx.db.get("sessions", args.sessionId)),
});

export const getActiveIecTaozRates = internalQuery({
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

export const insertBillImport = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    inputMode: v.union(
      v.literal("smartmeterCsv"),
      v.literal("pdfExtraction"),
      v.literal("manualEntry"),
    ),
    billingPeriodStart: v.number(),
    billingPeriodEnd: v.number(),
    totalKwh: v.number(),
    currentSupplierId: v.union(v.id("suppliers"), v.null()),
    currentPlanVersionId: v.union(v.id("planVersions"), v.null()),
    kwhWeekdayDay: v.optional(v.number()),
    kwhWeekdayNight: v.optional(v.number()),
    kwhWeekendDay: v.optional(v.number()),
    kwhWeekendNight: v.optional(v.number()),
    kwhTaozSummerPeak: v.optional(v.number()),
    kwhTaozSummerOffPeak: v.optional(v.number()),
    kwhTaozWinterPeak: v.optional(v.number()),
    kwhTaozWinterOffPeak: v.optional(v.number()),
    iecTaozRatesEffectiveFrom: v.optional(v.number()),
    rawFileStorageId: v.union(v.id("_storage"), v.null()),
    rawFileDeletedAt: v.union(v.number(), v.null()),
    parsedDataStorageId: v.union(v.id("_storage"), v.null()),
    userConfirmed: v.union(v.boolean(), v.null()),
    editedFieldCount: v.union(v.number(), v.null()),
    confirmedAt: v.union(v.number(), v.null()),
  },
  handler: async (ctx, args) => ctx.db.insert("billImports", args),
});

// ─────────────────────────────────────────────────────────────────────────────
// Action
// ─────────────────────────────────────────────────────────────────────────────

export const parseSmartMeterCsv = action({
  args: {
    storageId: v.id("_storage"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args): Promise<Id<"billImports">> =>
    withCapturedExceptions(() => runParseSmartMeterCsv(ctx, args), {
      sessionId: args.sessionId,
    }),
});

async function runParseSmartMeterCsv(
  ctx: ActionCtx,
  args: { storageId: Id<"_storage">; sessionId: Id<"sessions"> },
): Promise<Id<"billImports">> {
  const exists = await ctx.runQuery(internal.billImports.sessionExists, {
    sessionId: args.sessionId,
  });
  if (!exists) throw new Error("Session not found");

  const blob = await ctx.storage.get(args.storageId);
  if (!blob) throw new Error("File not found in storage");
  const text = await blob.text();

  const taozData = await ctx.runQuery(
    internal.billImports.getActiveIecTaozRates,
  );

  const parsed = parseSmartMeterCsvText(text, taozData.rows);

  return ctx.runMutation(internal.billImports.insertBillImport, {
    sessionId: args.sessionId,
    inputMode: "smartmeterCsv",
    billingPeriodStart: parsed.billingPeriodStart,
    billingPeriodEnd: parsed.billingPeriodEnd,
    totalKwh: parsed.totalKwh,
    currentSupplierId: null,
    currentPlanVersionId: null,
    kwhWeekdayDay: parsed.kwhWeekdayDay,
    kwhWeekdayNight: parsed.kwhWeekdayNight,
    kwhWeekendDay: parsed.kwhWeekendDay,
    kwhWeekendNight: parsed.kwhWeekendNight,
    kwhTaozSummerPeak: parsed.kwhTaozSummerPeak,
    kwhTaozSummerOffPeak: parsed.kwhTaozSummerOffPeak,
    kwhTaozWinterPeak: parsed.kwhTaozWinterPeak,
    kwhTaozWinterOffPeak: parsed.kwhTaozWinterOffPeak,
    ...(taozData.effectiveFrom !== null
      ? { iecTaozRatesEffectiveFrom: taozData.effectiveFrom }
      : {}),
    rawFileStorageId: args.storageId,
    rawFileDeletedAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    parsedDataStorageId: null,
    userConfirmed: null,
    editedFieldCount: null,
    confirmedAt: null,
  });
}
