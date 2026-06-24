import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";
import {
  buildAssumptions,
  calcCurrentPlanSavingsAgorot,
  calcSavingsAgorot,
  checkEligibility,
  computeWindowFractions,
  countStrongSignals,
  DEFAULT_ANNUAL_KWH,
  determineConfidence,
  estimateDayBandFraction,
} from "./lib/recommendationEngine";

export {
  buildAssumptions,
  calcCurrentPlanSavingsAgorot,
  calcSavingsAgorot,
  checkEligibility,
  computeWindowFractions,
  countStrongSignals,
  determineConfidence,
  estimateDayBandFraction,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// ₪200 = 20 000 agorot — gap above which No-Change Recommendation renders separately
const NO_CHANGE_SEPARATE_GAP_AGOROT = 20_000;

// 32 unambiguous chars for share codes (Crockford-inspired, uppercase only)
const SHARE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const SHARE_CODE_LENGTH = 6;

// Maximum plan versions to load (catalog is small; this is a safety bound)
const MAX_PLAN_VERSIONS = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Local types
// ─────────────────────────────────────────────────────────────────────────────

type BillImport = Doc<"billImports">;
type PlanVersion = Doc<"planVersions">;
type Plan = Doc<"plans">;

function makeShareCode(): string {
  let code = "";
  for (let i = 0; i < SHARE_CODE_LENGTH; i++) {
    code += SHARE_ALPHABET[Math.floor(Math.random() * SHARE_ALPHABET.length)];
  }
  return code;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mutations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Core engine entry point. Evaluates all active plan versions against the
 * provided home profile (and optional bill import), then persists a
 * Recommendation along with one EvaluatedPlanVersion row per plan version.
 */
export const generate = mutation({
  args: {
    sessionId: v.id("sessions"),
    homeProfileId: v.id("homeProfiles"),
    billImportId: v.union(v.id("billImports"), v.null()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get("sessions", args.sessionId);
    if (!session) throw new Error("Session not found");

    const profile = await ctx.db.get("homeProfiles", args.homeProfileId);
    if (!profile || profile.sessionId !== args.sessionId) {
      throw new Error(
        "Home profile not found or does not belong to this session",
      );
    }

    let bill: BillImport | null = null;
    if (args.billImportId) {
      bill = await ctx.db.get("billImports", args.billImportId);
      if (!bill || bill.sessionId !== args.sessionId) {
        throw new Error(
          "Bill import not found or does not belong to this session",
        );
      }
    }

    const confidence = determineConfidence(profile, bill);

    // ── Annual kWh ──────────────────────────────────────────────────────────
    let annualKwh: number;
    let usedDefaultKwh = false;
    if (bill) {
      const periodDays =
        (bill.billingPeriodEnd - bill.billingPeriodStart) / 86_400_000;
      annualKwh = bill.totalKwh * (365 / periodDays);
    } else if (profile.approximateMonthlyKwh !== null) {
      annualKwh = profile.approximateMonthlyKwh * 12;
    } else {
      annualKwh = DEFAULT_ANNUAL_KWH;
      usedDefaultKwh = true;
    }

    // ── Four kWh buckets (Weekday/Weekend × Day/Night) ──────────────────────
    // Day = 07:00–23:00, Night = 23:00–07:00, Weekday = Sun–Thu, Weekend = Fri–Sat.
    let weekdayDay = 0,
      weekdayNight = 0,
      weekendDay = 0,
      weekendNight = 0;
    if (confidence === "high" && bill) {
      const sf =
        365 / ((bill.billingPeriodEnd - bill.billingPeriodStart) / 86_400_000);
      weekdayDay = (bill.kwhWeekdayDay ?? 0) * sf;
      weekdayNight = (bill.kwhWeekdayNight ?? 0) * sf;
      weekendDay = (bill.kwhWeekendDay ?? 0) * sf;
      weekendNight = (bill.kwhWeekendNight ?? 0) * sf;
    } else if (confidence === "medium") {
      const dayBandFraction = estimateDayBandFraction(profile);
      weekdayDay = annualKwh * dayBandFraction * (5 / 7);
      weekdayNight = annualKwh * (1 - dayBandFraction) * (5 / 7);
      weekendDay = annualKwh * dayBandFraction * (2 / 7);
      weekendNight = annualKwh * (1 - dayBandFraction) * (2 / 7);
    }

    // Load the current IEC rate — must exist before recommendations can be generated
    const iecRateDoc = await ctx.db
      .query("iecRates")
      .withIndex("by_effective_to", (q) => q.eq("effectiveTo", null))
      .order("desc")
      .first();
    if (!iecRateDoc)
      throw new Error(
        "No active IEC rate found — seed one before generating recommendations",
      );
    const iecRate = iecRateDoc.rateAgorotPerKwh;

    const flatBaselineAnnualCostAgorot = Math.round(annualKwh * iecRate);

    // ── TAOZ baseline (smart-meter CSV with all four TAOZ buckets only) ───────
    let taozBaselineAnnualCostAgorot: number | null = null;

    const hasTaozData =
      bill !== null &&
      bill.kwhTaozSummerPeak != null &&
      bill.kwhTaozSummerOffPeak != null &&
      bill.kwhTaozWinterPeak != null &&
      bill.kwhTaozWinterOffPeak != null;

    if (hasTaozData && bill) {
      // Load the rate snapshot that was active when the CSV was bucketed.
      // Falls back to current active rates if the parser didn't record a snapshot.
      const taozRateRows =
        bill.iecTaozRatesEffectiveFrom != null
          ? await ctx.db
              .query("iecTaozRates")
              .withIndex("by_effective_from", (q) =>
                q.eq("effectiveFrom", bill.iecTaozRatesEffectiveFrom!),
              )
              .take(20)
          : await ctx.db
              .query("iecTaozRates")
              .withIndex("by_effective_to", (q) => q.eq("effectiveTo", null))
              .take(20);

      const sf =
        365 / ((bill.billingPeriodEnd - bill.billingPeriodStart) / 86_400_000);
      const rateFor = (
        season: "summer" | "winter" | "shoulder",
        period: "peak" | "offPeak",
      ) =>
        taozRateRows.find((r) => r.season === season && r.periodType === period)
          ?.rateAgorotPerKwh ?? iecRate;

      taozBaselineAnnualCostAgorot = Math.round(
        (bill.kwhTaozSummerPeak ?? 0) * sf * rateFor("summer", "peak") +
          (bill.kwhTaozSummerOffPeak ?? 0) * sf * rateFor("summer", "offPeak") +
          (bill.kwhTaozWinterPeak ?? 0) * sf * rateFor("winter", "peak") +
          (bill.kwhTaozWinterOffPeak ?? 0) * sf * rateFor("winter", "offPeak"),
      );
    }

    // ── Load active plan versions ────────────────────────────────────────────
    const activePvs = await ctx.db
      .query("planVersions")
      .withIndex("by_effective_to", (q) => q.eq("effectiveTo", null))
      .take(MAX_PLAN_VERSIONS);

    const planCache = new Map<Id<"plans">, Plan>();
    for (const pv of activePvs) {
      if (!planCache.has(pv.planId)) {
        const plan = await ctx.db.get("plans", pv.planId);
        if (plan) planCache.set(pv.planId, plan);
      }
    }

    // ── Current Plan Baseline (ADR-0024) ─────────────────────────────────────
    const currentPv = profile.currentPlanId
      ? (activePvs.find((pv) => pv.planId === profile.currentPlanId) ?? null)
      : null;
    const currentPlan = currentPv
      ? (planCache.get(currentPv.planId) ?? null)
      : null;
    const currentPlanSavingsAgorot = calcCurrentPlanSavingsAgorot(
      currentPv,
      currentPlan,
      annualKwh,
      weekdayDay,
      weekdayNight,
      weekendDay,
      weekendNight,
      iecRate,
    );
    const baselineAnnualCostAgorot =
      flatBaselineAnnualCostAgorot - currentPlanSavingsAgorot;

    // ── Evaluate each plan version ───────────────────────────────────────────
    type Evaluated = {
      pvId: Id<"planVersions">;
      planType: "fixed" | "day" | "night";
      isEligible: boolean;
      ineligibilityReason: string | null;
      annualSavingsAgorot: number;
    };

    const evaluated: Evaluated[] = [];
    let hasWeekendWindowPlan = false;

    for (const pv of activePvs) {
      const plan = planCache.get(pv.planId);
      if (!plan) continue; // orphaned plan version

      const { isEligible, ineligibilityReason } = checkEligibility(
        pv,
        plan,
        profile,
        confidence,
      );

      if (isEligible && plan.planType !== "fixed" && !pv.weekdayWindowOnly) {
        hasWeekendWindowPlan = true;
      }

      const savings = isEligible
        ? calcSavingsAgorot(
            pv,
            plan,
            annualKwh,
            weekdayDay,
            weekdayNight,
            weekendDay,
            weekendNight,
            iecRate,
          ) - currentPlanSavingsAgorot
        : 0;

      evaluated.push({
        pvId: pv._id,
        planType: plan.planType,
        isEligible,
        ineligibilityReason,
        annualSavingsAgorot: savings,
      });
    }

    // ── Select Primary and No-Change recommendations ─────────────────────────
    const eligible = evaluated.filter((e) => e.isEligible);
    if (eligible.length === 0) {
      throw new Error("No eligible plans found for this home profile");
    }

    const primary = eligible.reduce((best, cur) =>
      cur.annualSavingsAgorot > best.annualSavingsAgorot ? cur : best,
    );

    const eligibleFixed = eligible.filter((e) => e.planType === "fixed");
    if (eligibleFixed.length === 0) {
      throw new Error(
        "No eligible Fixed Plans found — cannot produce a No-Change Recommendation",
      );
    }
    const noChange = eligibleFixed.reduce((best, cur) =>
      cur.annualSavingsAgorot > best.annualSavingsAgorot ? cur : best,
    );

    const savingsGap =
      primary.annualSavingsAgorot - noChange.annualSavingsAgorot;

    // ── Persist ──────────────────────────────────────────────────────────────
    const recommendationId = await ctx.db.insert("recommendations", {
      sessionId: args.sessionId,
      homeProfileId: args.homeProfileId,
      billImportId: args.billImportId,
      confidenceLevel: confidence,
      iecRateId: iecRateDoc._id,
      baselineAnnualCostAgorot,
      taozBaselineAnnualCostAgorot,
      primaryPlanVersionId: primary.pvId,
      primaryAnnualSavingsAgorot: primary.annualSavingsAgorot,
      noChangePlanVersionId: noChange.pvId,
      noChangePlanAnnualSavingsAgorot: noChange.annualSavingsAgorot,
      showNoChangeSeparately: savingsGap > NO_CHANGE_SEPARATE_GAP_AGOROT,
      assumptions: buildAssumptions(
        confidence,
        usedDefaultKwh,
        hasTaozData,
        hasWeekendWindowPlan,
      ),
      shareCode: null,
    });

    for (const e of evaluated) {
      await ctx.db.insert("evaluatedPlanVersions", {
        recommendationId,
        planVersionId: e.pvId,
        annualSavingsAgorot: e.annualSavingsAgorot,
        isEligible: e.isEligible,
        ineligibilityReason: e.ineligibilityReason,
      });
    }

    return recommendationId;
  },
});

/**
 * Generates a 6-char share code for a recommendation and persists it.
 * Idempotent — returns the existing code if one was already generated.
 * Rate-limited by the 5-attempt collision guard.
 */
export const generateShareCode = mutation({
  args: {
    recommendationId: v.id("recommendations"),
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    const rec = await ctx.db.get("recommendations", args.recommendationId);
    if (!rec || rec.sessionId !== args.sessionId) {
      throw new Error("Recommendation not found or session mismatch");
    }
    if (rec.shareCode !== null) return rec.shareCode;

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeShareCode();
      const collision = await ctx.db
        .query("recommendations")
        .withIndex("by_share_code", (q) => q.eq("shareCode", code))
        .first();
      if (!collision) {
        await ctx.db.patch("recommendations", args.recommendationId, {
          shareCode: code,
        });
        return code;
      }
    }
    throw new Error(
      "Failed to generate a unique share code — please try again",
    );
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the most recent recommendation for a session. */
export const getForSession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("recommendations")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .first();
  },
});

/**
 * Returns enriched data for the share link page — plan name, supplier name,
 * and savings amount for the primary recommendation. Used by the SSR /r/[code] route.
 */
export const getSharePageData = query({
  args: { shareCode: v.string() },
  handler: async (ctx, args) => {
    const rec = await ctx.db
      .query("recommendations")
      .withIndex("by_share_code", (q) => q.eq("shareCode", args.shareCode))
      .unique();

    if (!rec) return null;

    const pv = await ctx.db.get("planVersions", rec.primaryPlanVersionId);
    if (!pv) return null;

    const plan = await ctx.db.get("plans", pv.planId);
    if (!plan) return null;

    const supplier = await ctx.db.get("suppliers", plan.supplierId);
    if (!supplier) return null;

    return {
      shareCode: rec.shareCode,
      planName: plan.name,
      supplierName: supplier.name,
      planType: plan.planType,
      discountPercent: pv.discountPercent,
      annualSavingsAgorot: rec.primaryAnnualSavingsAgorot,
      confidenceLevel: rec.confidenceLevel,
    };
  },
});

/** Returns a recommendation by its shareable code — no session auth required. */
export const getByShareCode = query({
  args: { shareCode: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("recommendations")
      .withIndex("by_share_code", (q) => q.eq("shareCode", args.shareCode))
      .unique();
  },
});

/**
 * Returns all evaluated plan versions for a recommendation, enriched with
 * plan and supplier data. Sorted: eligible first, then by savings descending.
 */
export const getEvaluatedPlans = query({
  args: { recommendationId: v.id("recommendations") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("evaluatedPlanVersions")
      .withIndex("by_recommendation", (q) =>
        q.eq("recommendationId", args.recommendationId),
      )
      .take(MAX_PLAN_VERSIONS);

    // Deduplicate plan and supplier reads
    const pvCache = new Map<Id<"planVersions">, PlanVersion | null>();
    const planCache = new Map<Id<"plans">, Plan | null>();
    const supplierCache = new Map<Id<"suppliers">, Doc<"suppliers"> | null>();

    for (const row of rows) {
      if (!pvCache.has(row.planVersionId)) {
        pvCache.set(
          row.planVersionId,
          await ctx.db.get("planVersions", row.planVersionId),
        );
      }
    }
    for (const pv of pvCache.values()) {
      if (pv && !planCache.has(pv.planId)) {
        planCache.set(pv.planId, await ctx.db.get("plans", pv.planId));
      }
    }
    for (const plan of planCache.values()) {
      if (plan && !supplierCache.has(plan.supplierId)) {
        supplierCache.set(
          plan.supplierId,
          await ctx.db.get("suppliers", plan.supplierId),
        );
      }
    }

    const enriched = rows.map((row) => {
      const pv = pvCache.get(row.planVersionId) ?? null;
      const plan = pv ? (planCache.get(pv.planId) ?? null) : null;
      const supplier = plan
        ? (supplierCache.get(plan.supplierId) ?? null)
        : null;
      return { ...row, planVersion: pv, plan, supplier };
    });

    return enriched.sort((a, b) => {
      if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
      return b.annualSavingsAgorot - a.annualSavingsAgorot;
    });
  },
});
