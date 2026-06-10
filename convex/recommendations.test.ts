import { describe, expect, it } from "vitest";
import type { Doc } from "./_generated/dataModel";
import {
  buildAssumptions,
  calcSavingsAgorot,
  checkEligibility,
  computeWindowFractions,
  countStrongSignals,
  determineConfidence,
  estimateDayBandFraction,
} from "./recommendations";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal mock factories
// ─────────────────────────────────────────────────────────────────────────────

function profile(overrides: Record<string, unknown> = {}): Doc<"homeProfiles"> {
  return {
    workFromHome: "sometimes",
    evChargingTime: null,
    washerDryerTime: null,
    acUsageLevel: "moderate",
    hasSmartMeter: "unknown",
    bundleMemberships: [],
    city: "Tel Aviv",
    ...overrides,
  } as unknown as Doc<"homeProfiles">;
}

function bill(overrides: Record<string, unknown> = {}): Doc<"billImports"> {
  return {
    inputMode: "smartmeterCsv",
    kwhWeekdayDay: 3000,
    kwhWeekdayNight: 1000,
    kwhWeekendDay: 1000,
    kwhWeekendNight: 500,
    ...overrides,
  } as unknown as Doc<"billImports">;
}

function planVersion(
  overrides: Record<string, unknown> = {},
): Doc<"planVersions"> {
  return {
    eligibility: {
      requiresSmartMeter: false,
      membershipRequired: null,
      residentialOnly: true,
      coverageAreas: [],
    },
    discountPercent: 7,
    weekdayWindowOnly: false,
    ...overrides,
  } as unknown as Doc<"planVersions">;
}

function plan(planType: "fixed" | "day" | "night"): Doc<"plans"> {
  return { planType } as unknown as Doc<"plans">;
}

// ─────────────────────────────────────────────────────────────────────────────
// computeWindowFractions
// ─────────────────────────────────────────────────────────────────────────────

describe("computeWindowFractions", () => {
  it("window 7–23 covers the full day band", () => {
    const { dayFraction, nightFraction } = computeWindowFractions(7, 23);
    expect(dayFraction).toBeCloseTo(1.0, 4);
    expect(nightFraction).toBeCloseTo(0, 4);
  });

  it("window 23–7 crosses midnight — full night band", () => {
    const { dayFraction, nightFraction } = computeWindowFractions(23, 7);
    expect(dayFraction).toBeCloseTo(0, 4);
    expect(nightFraction).toBeCloseTo(1.0, 4);
  });

  it("window 0–7 covers 7 of 8 night hours", () => {
    const { dayFraction, nightFraction } = computeWindowFractions(0, 7);
    expect(dayFraction).toBeCloseTo(0, 4);
    expect(nightFraction).toBeCloseTo(7 / 8, 4);
  });

  it("window 7–17 covers 10 of 16 day hours", () => {
    const { dayFraction, nightFraction } = computeWindowFractions(7, 17);
    expect(dayFraction).toBeCloseTo(10 / 16, 4);
    expect(nightFraction).toBeCloseTo(0, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// estimateDayBandFraction
// ─────────────────────────────────────────────────────────────────────────────

describe("estimateDayBandFraction", () => {
  it("baseline returns 0.65", () => {
    expect(estimateDayBandFraction(profile())).toBeCloseTo(0.65, 4);
  });

  it("EV night charging reduces by 0.06", () => {
    expect(
      estimateDayBandFraction(profile({ evChargingTime: "night" })),
    ).toBeCloseTo(0.59, 4);
  });

  it("washer/dryer at night reduces by 0.04", () => {
    expect(
      estimateDayBandFraction(profile({ washerDryerTime: "night" })),
    ).toBeCloseTo(0.61, 4);
  });

  it("heavy AC usage increases by 0.04", () => {
    expect(
      estimateDayBandFraction(profile({ acUsageLevel: "heavy" })),
    ).toBeCloseTo(0.69, 4);
  });

  it("always WFH increases by 0.03", () => {
    expect(
      estimateDayBandFraction(profile({ workFromHome: "always" })),
    ).toBeCloseTo(0.68, 4);
  });

  it("stacked negatives stay above floor 0.40", () => {
    const f = estimateDayBandFraction(
      profile({ evChargingTime: "night", washerDryerTime: "night" }),
    );
    expect(f).toBeGreaterThanOrEqual(0.4);
    expect(f).toBeCloseTo(0.55, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// countStrongSignals
// ─────────────────────────────────────────────────────────────────────────────

describe("countStrongSignals", () => {
  it("returns 0 for no signals", () => {
    expect(countStrongSignals(profile())).toBe(0);
  });

  it("WFH always counts as 1", () => {
    expect(countStrongSignals(profile({ workFromHome: "always" }))).toBe(1);
  });

  it("EV with declared charging time counts as 1", () => {
    expect(countStrongSignals(profile({ evChargingTime: "night" }))).toBe(1);
    expect(countStrongSignals(profile({ evChargingTime: "day" }))).toBe(1);
  });

  it("washer/dryer with declared timing counts as 1", () => {
    expect(countStrongSignals(profile({ washerDryerTime: "day" }))).toBe(1);
  });

  it("all three signals returns 3", () => {
    expect(
      countStrongSignals(
        profile({
          workFromHome: "always",
          evChargingTime: "night",
          washerDryerTime: "day",
        }),
      ),
    ).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// determineConfidence
// ─────────────────────────────────────────────────────────────────────────────

describe("determineConfidence", () => {
  it("smartmeterCsv bill with all four buckets → high", () => {
    expect(determineConfidence(profile(), bill())).toBe("high");
  });

  it("smartmeterCsv bill with missing bucket → not high", () => {
    const result = determineConfidence(
      profile(),
      bill({ kwhWeekdayDay: undefined }),
    );
    expect(result).not.toBe("high");
  });

  it("no bill, 2 strong signals → medium", () => {
    expect(
      determineConfidence(
        profile({ workFromHome: "always", evChargingTime: "night" }),
        null,
      ),
    ).toBe("medium");
  });

  it("no bill, 1 strong signal → low", () => {
    expect(determineConfidence(profile({ workFromHome: "always" }), null)).toBe(
      "low",
    );
  });

  it("no bill, 0 signals → low", () => {
    expect(determineConfidence(profile(), null)).toBe("low");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkEligibility
// ─────────────────────────────────────────────────────────────────────────────

describe("checkEligibility", () => {
  it("requiresSmartMeter + no smart meter → ineligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      }),
      plan("day"),
      profile({ hasSmartMeter: "no" }),
      "high",
    );
    expect(isEligible).toBe(false);
  });

  it("requiresSmartMeter + has smart meter → eligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: true,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      }),
      plan("day"),
      profile({ hasSmartMeter: "yes" }),
      "high",
    );
    expect(isEligible).toBe(true);
  });

  it("membershipRequired not in profile → ineligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: "HOT triple",
          residentialOnly: true,
          coverageAreas: [],
        },
      }),
      plan("fixed"),
      profile({ bundleMemberships: [] }),
      "high",
    );
    expect(isEligible).toBe(false);
  });

  it("membershipRequired present in profile → eligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: "HOT triple",
          residentialOnly: true,
          coverageAreas: [],
        },
      }),
      plan("fixed"),
      profile({ bundleMemberships: ["HOT triple"] }),
      "high",
    );
    expect(isEligible).toBe(true);
  });

  it("compound membership — all required → eligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: "HOT triple + HOT Mobile",
          residentialOnly: true,
          coverageAreas: [],
        },
      }),
      plan("fixed"),
      profile({ bundleMemberships: ["HOT triple", "HOT Mobile"] }),
      "high",
    );
    expect(isEligible).toBe(true);
  });

  it("compound membership — partial → ineligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: "HOT triple + HOT Mobile",
          residentialOnly: true,
          coverageAreas: [],
        },
      }),
      plan("fixed"),
      profile({ bundleMemberships: ["HOT triple"] }),
      "high",
    );
    expect(isEligible).toBe(false);
  });

  it("coverageAreas non-empty + city not listed → ineligible", () => {
    const { isEligible } = checkEligibility(
      planVersion({
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: ["Tel Aviv"],
        },
      }),
      plan("fixed"),
      profile({ city: "Jerusalem" }),
      "high",
    );
    expect(isEligible).toBe(false);
  });

  it("coverageAreas empty (nationwide) → eligible regardless of city", () => {
    const { isEligible } = checkEligibility(
      planVersion(),
      plan("fixed"),
      profile({ city: "Haifa" }),
      "high",
    );
    expect(isEligible).toBe(true);
  });

  it("low confidence + non-fixed plan → ineligible", () => {
    const { isEligible, ineligibilityReason } = checkEligibility(
      planVersion(),
      plan("day"),
      profile(),
      "low",
    );
    expect(isEligible).toBe(false);
    expect(ineligibilityReason).not.toBeNull();
  });

  it("low confidence + fixed plan → eligible", () => {
    const { isEligible } = checkEligibility(
      planVersion(),
      plan("fixed"),
      profile(),
      "low",
    );
    expect(isEligible).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// calcSavingsAgorot
// ─────────────────────────────────────────────────────────────────────────────

describe("calcSavingsAgorot", () => {
  const iecRate = 64.32;
  const kwd = 4000,
    kwn = 1000,
    kwed = 2000,
    kwen = 1000;

  it("fixed plan: Math.round(annualKwh × rate × discount%)", () => {
    const pv = planVersion({ discountPercent: 7 });
    expect(
      calcSavingsAgorot(pv, plan("fixed"), 8000, kwd, kwn, kwed, kwen, iecRate),
    ).toBe(Math.round(8000 * iecRate * 0.07));
  });

  it("day plan window 7–23 (dayFraction=1): only day-band kWh discounted", () => {
    const pv = planVersion({
      discountPercent: 15,
      discountWindowStartHour: 7,
      discountWindowEndHour: 23,
      weekdayWindowOnly: false,
    });
    // dayFraction=1, nightFraction=0 → discountedKwh = weekdayDay + weekendDay = 4000+2000 = 6000
    expect(
      calcSavingsAgorot(pv, plan("day"), 8000, kwd, kwn, kwed, kwen, iecRate),
    ).toBe(Math.round(6000 * iecRate * 0.15));
  });

  it("night plan window 23–7 (nightFraction=1): only night-band kWh discounted", () => {
    const pv = planVersion({
      discountPercent: 20,
      discountWindowStartHour: 23,
      discountWindowEndHour: 7,
      weekdayWindowOnly: false,
    });
    // dayFraction=0, nightFraction=1 → discountedKwh = weekdayNight + weekendNight = 1000+1000 = 2000
    expect(
      calcSavingsAgorot(pv, plan("night"), 8000, kwd, kwn, kwed, kwen, iecRate),
    ).toBe(Math.round(2000 * iecRate * 0.2));
  });

  it("weekday-only window excludes weekend contribution", () => {
    const pv = planVersion({
      discountPercent: 15,
      discountWindowStartHour: 7,
      discountWindowEndHour: 23,
      weekdayWindowOnly: true,
    });
    // discountedKwh = weekdayDay only = 4000
    expect(
      calcSavingsAgorot(pv, plan("day"), 8000, kwd, kwn, kwed, kwen, iecRate),
    ).toBe(Math.round(4000 * iecRate * 0.15));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildAssumptions
// ─────────────────────────────────────────────────────────────────────────────

describe("buildAssumptions", () => {
  type Entry = { key: string; params?: Record<string, unknown> };
  const parse = (s: string): Entry[] => JSON.parse(s) as Entry[];

  it("high confidence returns assumption_high_confidence key", () => {
    const parts = parse(buildAssumptions("high", false, false, false));
    expect(parts).toHaveLength(1);
    expect(parts[0].key).toBe("assumption_high_confidence");
  });

  it("medium confidence returns assumption_medium_confidence key", () => {
    const [first] = parse(buildAssumptions("medium", false, false, false));
    expect(first.key).toBe("assumption_medium_confidence");
  });

  it("low confidence returns assumption_low_confidence key", () => {
    const [first] = parse(buildAssumptions("low", false, false, false));
    expect(first.key).toBe("assumption_low_confidence");
  });

  it("usedDefaultKwh adds assumption_default_kwh entry with kwh param", () => {
    const parts = parse(buildAssumptions("high", true, false, false));
    const entry = parts.find((p) => p.key === "assumption_default_kwh");
    expect(entry).toBeDefined();
    expect(entry?.params?.kwh).toBe("8,000");
  });

  it("hasTaozData adds assumption_taoz_data entry", () => {
    const parts = parse(buildAssumptions("high", false, true, false));
    expect(parts.some((p) => p.key === "assumption_taoz_data")).toBe(true);
  });

  it("hasWeekendWindowPlan + medium confidence adds assumption_weekend_window", () => {
    const parts = parse(buildAssumptions("medium", false, false, true));
    expect(parts.some((p) => p.key === "assumption_weekend_window")).toBe(true);
  });

  it("hasWeekendWindowPlan + high confidence does NOT add assumption_weekend_window", () => {
    const parts = parse(buildAssumptions("high", false, false, true));
    expect(parts.every((p) => p.key !== "assumption_weekend_window")).toBe(
      true,
    );
  });
});
