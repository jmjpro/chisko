import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";
import { seedSession } from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");

type ConvexTestInstance = ReturnType<typeof convexTest>;

async function seedCatalog(
  t: ConvexTestInstance,
  currentDiscountPercent = 5,
  candidateDiscountPercent = 10,
) {
  return t.run(async (ctx) => {
    await ctx.db.insert("iecRates", {
      rateAgorotPerKwh: 64.32,
      effectiveFrom: 0,
      effectiveTo: null,
    });

    const currentSupplierId = await ctx.db.insert("suppliers", {
      name: "Current Co",
      logoFileName: "currentCo.webp",
      isActive: true,
      supportedHandoffTypes: ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    });
    const currentPlanId = await ctx.db.insert("plans", {
      supplierId: currentSupplierId,
      name: "Current Fixed",
      planType: "fixed",
    });
    const currentPlanVersionId = await ctx.db.insert("planVersions", {
      planId: currentPlanId,
      effectiveFrom: 0,
      effectiveTo: null,
      discountPercent: currentDiscountPercent,
      benefitDelivery: "billDiscount",
      weekdayWindowOnly: false,
      eligibility: {
        requiresSmartMeter: false,
        membershipRequired: null,
        residentialOnly: true,
        coverageAreas: [],
      },
    });

    const betterSupplierId = await ctx.db.insert("suppliers", {
      name: "Better Co",
      logoFileName: "betterCo.webp",
      isActive: true,
      supportedHandoffTypes: ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    });
    const betterPlanId = await ctx.db.insert("plans", {
      supplierId: betterSupplierId,
      name: "Better Fixed",
      planType: "fixed",
    });
    const betterPlanVersionId = await ctx.db.insert("planVersions", {
      planId: betterPlanId,
      effectiveFrom: 0,
      effectiveTo: null,
      discountPercent: candidateDiscountPercent,
      benefitDelivery: "billDiscount",
      weekdayWindowOnly: false,
      eligibility: {
        requiresSmartMeter: false,
        membershipRequired: null,
        residentialOnly: true,
        coverageAreas: [],
      },
    });

    return {
      currentSupplierId,
      currentPlanId,
      currentPlanVersionId,
      betterPlanVersionId,
    };
  });
}

async function seedProfile(
  t: ConvexTestInstance,
  sessionId: Id<"sessions">,
  currentSupplierId: Id<"suppliers"> | null,
  currentPlanId: Id<"plans"> | null,
) {
  return t.mutation(api.homeProfiles.upsert, {
    sessionId,
    hasSmartMeter: "unknown",
    bundleMemberships: [],
    placeOfResidence: { he: "תל אביב" },
    currentSupplierId,
    currentPlanId,
    approximateMonthlyKwh: 800,
    workFromHome: "sometimes",
    hasEv: false,
    evChargingTime: null,
    washerDryerTime: null,
    acUsageLevel: "moderate",
    willingToShiftUsage: false,
    willingToAcceptOffBillBenefits: true,
  });
}

test("known current plan: baseline and candidate savings are computed relative to it, not the flat IEC rate", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { currentSupplierId, currentPlanId, betterPlanVersionId } =
    await seedCatalog(t);
  const homeProfileId = await seedProfile(
    t,
    sessionId,
    currentSupplierId,
    currentPlanId,
  );

  const recommendationId = await t.mutation(api.recommendations.generate, {
    sessionId,
    homeProfileId,
    billImportId: null,
  });

  const rec = await t.run((ctx) =>
    ctx.db.get("recommendations", recommendationId),
  );
  const iecRate = 64.32;
  const annualKwh = 800 * 12;
  const flatBaseline = Math.round(annualKwh * iecRate);
  const currentPlanSavingsVsIec = Math.round(annualKwh * iecRate * 0.05);
  expect(rec?.baselineAnnualCostAgorot).toBe(
    flatBaseline - currentPlanSavingsVsIec,
  );

  const evaluated = await t.query(api.recommendations.getEvaluatedPlans, {
    recommendationId,
  });
  const better = evaluated.find((e) => e.planVersionId === betterPlanVersionId);
  const betterSavingsVsIec = Math.round(annualKwh * iecRate * 0.1);
  expect(better?.annualSavingsAgorot).toBe(
    betterSavingsVsIec - currentPlanSavingsVsIec,
  );

  const current = evaluated.find((e) => e.plan?.name === "Current Fixed");
  expect(current?.annualSavingsAgorot).toBe(0);
});

test("unknown current plan: baseline falls back to the flat IEC rate exactly as before", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  await seedCatalog(t);
  const homeProfileId = await seedProfile(t, sessionId, null, null);

  const recommendationId = await t.mutation(api.recommendations.generate, {
    sessionId,
    homeProfileId,
    billImportId: null,
  });

  const rec = await t.run((ctx) =>
    ctx.db.get("recommendations", recommendationId),
  );
  const iecRate = 64.32;
  const annualKwh = 800 * 12;
  expect(rec?.baselineAnnualCostAgorot).toBe(Math.round(annualKwh * iecRate));
});

test("no candidate beats the current plan: it still surfaces as primary, and the worse candidate shows negative savings rather than being hidden", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const {
    currentSupplierId,
    currentPlanId,
    currentPlanVersionId,
    betterPlanVersionId,
  } = await seedCatalog(t, 20, 10);
  const homeProfileId = await seedProfile(
    t,
    sessionId,
    currentSupplierId,
    currentPlanId,
  );

  const recommendationId = await t.mutation(api.recommendations.generate, {
    sessionId,
    homeProfileId,
    billImportId: null,
  });

  const rec = await t.run((ctx) =>
    ctx.db.get("recommendations", recommendationId),
  );
  expect(rec?.primaryPlanVersionId).toBe(currentPlanVersionId);
  expect(rec?.primaryAnnualSavingsAgorot).toBe(0);

  const evaluated = await t.query(api.recommendations.getEvaluatedPlans, {
    recommendationId,
  });
  const worse = evaluated.find((e) => e.planVersionId === betterPlanVersionId);
  expect(worse?.isEligible).toBe(true);
  expect(worse?.annualSavingsAgorot).toBeLessThan(0);
});
