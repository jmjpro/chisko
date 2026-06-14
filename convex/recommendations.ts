import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// Fallback annual kWh when neither a bill import nor a questionnaire estimate is available
const DEFAULT_ANNUAL_KWH = 8_000;

// Hour-band boundaries for the four usage buckets stored on billImports
const DAY_START = 7; // 07:00 inclusive
const DAY_END = 23; // 23:00 exclusive
const DAY_HOURS = DAY_END - DAY_START; // 16
const NIGHT_HOURS = 24 - DAY_HOURS; // 8

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

type Profile = Doc<"homeProfiles">;
type BillImport = Doc<"billImports">;
type PlanVersion = Doc<"planVersions">;
type Plan = Doc<"plans">;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export function countStrongSignals(p: Profile): number {
  let n = 0;
  // WFH=always is a strong indicator of high daytime consumption
  if (p.workFromHome === "always") n++;
  // EV or washer/dryer with a declared timing is a strong indicator
  if (p.evChargingTime === "day" || p.evChargingTime === "night") n++;
  if (p.washerDryerTime === "day" || p.washerDryerTime === "night") n++;
  return n;
}

export function determineConfidence(
  p: Profile,
  bill: BillImport | null,
): "high" | "medium" | "low" {
  if (
    bill?.inputMode === "smartmeterCsv" &&
    bill.kwhWeekdayDay != null &&
    bill.kwhWeekdayNight != null &&
    bill.kwhWeekendDay != null &&
    bill.kwhWeekendNight != null
  ) {
    return "high";
  }
  return countStrongSignals(p) >= 2 ? "medium" : "low";
}

/**
 * Estimates the fraction of annual kWh consumed during the day band (07:00–23:00).
 * Complement (1 − result) is the night band (23:00–07:00).
 * Used only for medium-confidence recommendations without smart-meter data.
 */
export function estimateDayBandFraction(p: Profile): number {
  let f = 0.65; // baseline: slightly below the proportional 16/24 = 0.667
  if (p.evChargingTime === "night") f -= 0.06;
  if (p.washerDryerTime === "night") f -= 0.04;
  if (p.acUsageLevel === "heavy") f += 0.04;
  if (p.workFromHome === "always") f += 0.03;
  return Math.max(0.4, Math.min(f, 0.85));
}

export function checkEligibility(
  pv: PlanVersion,
  plan: Plan,
  p: Profile,
  confidence: "high" | "medium" | "low",
): { isEligible: boolean; ineligibilityReason: string | null } {
  // Low confidence: restrict to Fixed Plans only
  if (confidence === "low" && plan.planType !== "fixed") {
    return {
      isEligible: false,
      ineligibilityReason: JSON.stringify({
        key: "ineligibility_low_confidence",
      }),
    };
  }

  if (pv.benefitDelivery === "appCredit" && !p.willingToAcceptOffBillBenefits) {
    return {
      isEligible: false,
      ineligibilityReason: JSON.stringify({
        key: "ineligibility_off_bill_benefit_declined",
      }),
    };
  }

  const e = pv.eligibility;

  if (e.requiresSmartMeter && p.hasSmartMeter !== "yes") {
    return {
      isEligible: false,
      ineligibilityReason: JSON.stringify({
        key: "ineligibility_requires_smart_meter",
      }),
    };
  }

  if (e.membershipRequired !== null) {
    // Compound requirements use " + " as separator, e.g. "HOT triple + HOT Mobile"
    const required = e.membershipRequired.split(" + ");
    if (!required.every((r) => p.bundleMemberships.includes(r))) {
      return {
        isEligible: false,
        ineligibilityReason: JSON.stringify({
          key: "ineligibility_membership_required",
          params: { membership: e.membershipRequired },
        }),
      };
    }
  }

  // Empty coverageAreas = nationwide; otherwise placeOfResidence.he must be listed
  if (
    e.coverageAreas.length > 0 &&
    !e.coverageAreas.includes(p.placeOfResidence.he)
  ) {
    return {
      isEligible: false,
      ineligibilityReason: JSON.stringify({
        key: "ineligibility_coverage_area",
      }),
    };
  }

  return { isEligible: true, ineligibilityReason: null };
}

/**
 * Returns what fraction of the day-band (07:00–23:00) and night-band (23:00–07:00)
 * a plan's discount window occupies. Handles windows that cross midnight.
 */
export function computeWindowFractions(
  startHour: number,
  endHour: number,
): { dayFraction: number; nightFraction: number } {
  const totalHours =
    endHour > startHour ? endHour - startHour : 24 - startHour + endHour;

  let dayHours = 0;
  let h = startHour;
  for (let i = 0; i < totalHours; i++) {
    if (h >= DAY_START && h < DAY_END) dayHours++;
    h = (h + 1) % 24;
  }

  return {
    dayFraction: dayHours / DAY_HOURS,
    nightFraction: (totalHours - dayHours) / NIGHT_HOURS,
  };
}

export function calcSavingsAgorot(
  pv: PlanVersion,
  plan: Plan,
  annualKwh: number,
  weekdayDay: number,
  weekdayNight: number,
  weekendDay: number,
  weekendNight: number,
  iecRate: number,
): number {
  let savings: number;

  if (plan.planType === "fixed") {
    savings = Math.round(annualKwh * iecRate * (pv.discountPercent / 100));
  } else {
    const { dayFraction, nightFraction } = computeWindowFractions(
      pv.discountWindowStartHour!,
      pv.discountWindowEndHour!,
    );

    const weekdayKwh = weekdayDay * dayFraction + weekdayNight * nightFraction;
    const discountedKwh = pv.weekdayWindowOnly
      ? weekdayKwh
      : weekdayKwh + weekendDay * dayFraction + weekendNight * nightFraction;

    savings = Math.round(discountedKwh * iecRate * (pv.discountPercent / 100));
  }

  return Math.min(savings, pv.annualSavingsCapAgorot ?? Infinity);
}

type AssumptionEntry = {
  key: string;
  params?: Record<string, string | number>;
};

export function buildAssumptions(
  confidence: "high" | "medium" | "low",
  usedDefaultKwh: boolean,
  hasTaozData: boolean,
  hasWeekendWindowPlan: boolean,
): string {
  const parts: AssumptionEntry[] = [];
  if (confidence === "high") {
    parts.push({ key: "assumption_high_confidence" });
  } else if (confidence === "medium") {
    parts.push({ key: "assumption_medium_confidence" });
  } else {
    parts.push({ key: "assumption_low_confidence" });
  }
  if (usedDefaultKwh) {
    parts.push({
      key: "assumption_default_kwh",
      params: { kwh: DEFAULT_ANNUAL_KWH.toLocaleString("en-US") },
    });
  }
  if (hasTaozData) {
    parts.push({ key: "assumption_taoz_data" });
  }
  if (hasWeekendWindowPlan && confidence === "medium") {
    parts.push({ key: "assumption_weekend_window" });
  }
  return JSON.stringify(parts);
}

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

    const baselineAnnualCostAgorot = Math.round(annualKwh * iecRate);

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
          )
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
