// Pure recommendation-matching logic — no Convex server/runtime imports, so this
// module can be bundled into the browser as-is for the CHI-47 client-side POC.
import type { Doc } from "../_generated/dataModel";

export type Profile = Doc<"homeProfiles">;
export type PlanVersion = Doc<"planVersions">;
export type Plan = Doc<"plans">;

// Fallback annual kWh when neither a bill import nor a questionnaire estimate is available
export const DEFAULT_ANNUAL_KWH = 8_000;

// Hour-band boundaries for the four usage buckets stored on billImports
export const DAY_START = 7; // 07:00 inclusive
export const DAY_END = 23; // 23:00 exclusive
export const DAY_HOURS = DAY_END - DAY_START; // 16
export const NIGHT_HOURS = 24 - DAY_HOURS; // 8

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
  bill: Doc<"billImports"> | null,
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
    // " + "-separated means every named membership is required;
    // ", or"-separated means any one of them suffices.
    const isAnyOf = e.membershipRequired.includes(", or");
    const required = isAnyOf
      ? e.membershipRequired.split(", or").map((r) => r.trim())
      : e.membershipRequired.split(" + ");
    const satisfied = isAnyOf
      ? required.some((r) => p.bundleMemberships.includes(r))
      : required.every((r) => p.bundleMemberships.includes(r));
    if (!satisfied) {
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

/**
 * The Current Plan Baseline (ADR-0025): the household's current plan, evaluated
 * through the same savings-vs-IEC-Rate calculation as any candidate. Returns 0
 * (no adjustment, IEC Rate baseline applies) when the current plan is unknown
 * or has no active plan version.
 */
export function calcCurrentPlanSavingsAgorot(
  currentPv: PlanVersion | null,
  currentPlan: Plan | null,
  annualKwh: number,
  weekdayDay: number,
  weekdayNight: number,
  weekendDay: number,
  weekendNight: number,
  iecRate: number,
): number {
  if (!currentPv || !currentPlan) return 0;
  return calcSavingsAgorot(
    currentPv,
    currentPlan,
    annualKwh,
    weekdayDay,
    weekdayNight,
    weekendDay,
    weekendNight,
    iecRate,
  );
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
