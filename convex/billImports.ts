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
// CSV parsing helpers (pure — not exported, used only by the action)
// ─────────────────────────────────────────────────────────────────────────────

type TaozRateRow = {
  season: "summer" | "winter" | "shoulder";
  periodType: "peak" | "offPeak";
  startMonth: number;
  endMonth: number;
  startHour: number;
  endHour: number;
};

type TaozBucket =
  | "summerPeak"
  | "summerOffPeak"
  | "winterPeak"
  | "winterOffPeak"
  | "shoulderOffPeak";

function isMonthInRange(
  month: number,
  startMonth: number,
  endMonth: number,
): boolean {
  return endMonth >= startMonth
    ? month >= startMonth && month <= endMonth
    : month >= startMonth || month <= endMonth;
}

function isHourInWindow(
  hour: number,
  startHour: number,
  endHour: number,
): boolean {
  // endHour=24 means all hours (shoulder, full-day window)
  return endHour > startHour
    ? hour >= startHour && hour < endHour
    : hour >= startHour || hour < endHour;
}

function getTaozBucket(
  month: number,
  hour: number,
  rates: TaozRateRow[],
): TaozBucket {
  for (const rate of rates) {
    if (!isMonthInRange(month, rate.startMonth, rate.endMonth)) continue;
    if (!isHourInWindow(hour, rate.startHour, rate.endHour)) continue;
    if (rate.season === "summer" && rate.periodType === "peak")
      return "summerPeak";
    if (rate.season === "summer") return "summerOffPeak";
    if (rate.season === "winter" && rate.periodType === "peak")
      return "winterPeak";
    if (rate.season === "winter") return "winterOffPeak";
    return "shoulderOffPeak";
  }
  return "shoulderOffPeak"; // fallback
}

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

  // Strip UTF-8 BOM if present
  const cleaned = text.startsWith("﻿") ? text.slice(1) : text;
  const lines = cleaned
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let kwhWeekdayDay = 0;
  let kwhWeekdayNight = 0;
  let kwhWeekendDay = 0;
  let kwhWeekendNight = 0;
  let kwhTaozSummerPeak = 0;
  let kwhTaozSummerOffPeak = 0;
  let kwhTaozWinterPeak = 0;
  let kwhTaozWinterOffPeak = 0;
  let totalKwh = 0;
  let minDate = Infinity;
  let maxDate = -Infinity;

  for (const line of lines) {
    // Format: "meterID","צריכה","DD/MM/YYYY","HH:MM",kWh,flag
    const parts = line.split(",");
    if (parts.length < 5) continue;

    const type = parts[1].replace(/"/g, "").trim();
    if (type !== "צריכה") continue;

    const dateStr = parts[2].replace(/"/g, "").trim();
    const timeStr = parts[3].replace(/"/g, "").trim();
    const kwhStr = parts[4].replace(/"/g, "").trim();

    const dateParts = dateStr.split("/");
    if (dateParts.length !== 3) continue;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const year = parseInt(dateParts[2], 10);
    if (isNaN(day) || isNaN(month) || isNaN(year)) continue;

    const timeParts = timeStr.split(":");
    const hour = parseInt(timeParts[0], 10);
    if (isNaN(hour)) continue;

    const kwh = parseFloat(kwhStr);
    if (isNaN(kwh)) continue;

    const dateTs = new Date(year, month - 1, day).getTime();
    if (dateTs < minDate) minDate = dateTs;
    if (dateTs > maxDate) maxDate = dateTs;

    // 0=Sun…6=Sat; Israeli convention: Fri(5)+Sat(6) = weekend
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const isDayBand = hour >= 7 && hour < 23;

    if (isWeekend) {
      if (isDayBand) kwhWeekendDay += kwh;
      else kwhWeekendNight += kwh;
    } else {
      if (isDayBand) kwhWeekdayDay += kwh;
      else kwhWeekdayNight += kwh;
    }
    totalKwh += kwh;

    const bucket = getTaozBucket(month, hour, taozData.rows);
    if (bucket === "summerPeak") kwhTaozSummerPeak += kwh;
    else if (bucket === "summerOffPeak") kwhTaozSummerOffPeak += kwh;
    else if (bucket === "winterPeak") kwhTaozWinterPeak += kwh;
    else kwhTaozWinterOffPeak += kwh; // winterOffPeak + shoulderOffPeak
  }

  if (!isFinite(minDate)) throw new Error("No valid rows parsed from CSV");

  return ctx.runMutation(internal.billImports.insertBillImport, {
    sessionId: args.sessionId,
    inputMode: "smartmeterCsv",
    billingPeriodStart: minDate,
    billingPeriodEnd: maxDate + 86_400_000,
    totalKwh,
    currentSupplierId: null,
    currentPlanVersionId: null,
    kwhWeekdayDay,
    kwhWeekdayNight,
    kwhWeekendDay,
    kwhWeekendNight,
    kwhTaozSummerPeak,
    kwhTaozSummerOffPeak,
    kwhTaozWinterPeak,
    kwhTaozWinterOffPeak,
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
