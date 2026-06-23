import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedSession, seedSupplierAndPlan } from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");

test("submitLeadForm creates a Lead, a form-handoff Referral, and an open delivery", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t);

  const { leadId, referralId } = await t.mutation(api.leads.submitLeadForm, {
    sessionId,
    supplierId,
    planVersionId,
    name: "Yossi",
    phone: "0501234567",
    email: null,
  });

  const lead = await t.run((ctx) => ctx.db.get("leads", leadId));
  expect(lead).toMatchObject({
    sessionId,
    name: "Yossi",
    phone: "0501234567",
    email: null,
  });
  expect(lead?.recommendationId).toBeUndefined();

  const referral = await t.run((ctx) => ctx.db.get("referrals", referralId));
  expect(referral).toMatchObject({
    leadId,
    supplierId,
    planVersionId,
    handoffType: "formHandoff",
  });

  const deliveries = await t.run((ctx) =>
    ctx.db
      .query("formSubmissionDeliveries")
      .withIndex("by_referral", (q) => q.eq("referralId", referralId))
      .collect(),
  );
  expect(deliveries).toHaveLength(1);
  expect(deliveries[0]).toMatchObject({
    referralId,
    state: "open",
    attempts: 0,
    processingStartedAt: null,
  });
});

test("submitLeadForm carries recommendationId when provided (wizard results step)", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t);
  const recommendationId = await t.run(async (ctx) => {
    const homeProfileId = await ctx.db.insert("homeProfiles", {
      sessionId,
      hasSmartMeter: "unknown",
      bundleMemberships: [],
      placeOfResidence: { he: "תל אביב" },
      currentSupplierId: null,
      currentPlanId: null,
      approximateMonthlyKwh: null,
      workFromHome: "sometimes",
      hasEv: false,
      evChargingTime: null,
      washerDryerTime: null,
      acUsageLevel: "moderate",
      willingToShiftUsage: false,
      willingToAcceptOffBillBenefits: true,
    });
    const iecRateId = await ctx.db.insert("iecRates", {
      rateAgorotPerKwh: 64.32,
      effectiveFrom: 0,
      effectiveTo: null,
    });
    return ctx.db.insert("recommendations", {
      sessionId,
      homeProfileId,
      billImportId: null,
      confidenceLevel: "high",
      iecRateId,
      baselineAnnualCostAgorot: 0,
      taozBaselineAnnualCostAgorot: null,
      primaryPlanVersionId: planVersionId,
      primaryAnnualSavingsAgorot: 0,
      noChangePlanVersionId: planVersionId,
      noChangePlanAnnualSavingsAgorot: 0,
      showNoChangeSeparately: false,
      assumptions: "[]",
      shareCode: null,
    });
  });

  const { leadId } = await t.mutation(api.leads.submitLeadForm, {
    sessionId,
    recommendationId,
    supplierId,
    planVersionId,
    name: "Avi",
    phone: "0501112222",
    email: null,
  });

  const lead = await t.run((ctx) => ctx.db.get("leads", leadId));
  expect(lead?.recommendationId).toBe(recommendationId);
});

// ─────────────────────────────────────────────────────────────────────────────
// getFanOutScope
// ─────────────────────────────────────────────────────────────────────────────

test("getFanOutScope with a recommendation returns the eligible-plan pool, excluding the referred supplier", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const {
    supplierId: referredSupplierId,
    planVersionId: referredPlanVersionId,
  } = await seedSupplierAndPlan(t);
  const { supplierId: otherSupplierId, planVersionId: otherPlanVersionId } =
    await seedSupplierAndPlan(t);
  // A third supplier is eligible in the pool but doesn't support formHandoff —
  // must be excluded from fan-out regardless of eligibility.
  const { planVersionId: clickThroughOnlyPlanVersionId } = await t.run(
    async (ctx) => {
      const supplierId = await ctx.db.insert("suppliers", {
        name: "Click Through Only",
        logoFileName: "clickThroughOnly.webp",
        isActive: true,
        supportedHandoffTypes: ["clickThrough"],
        payoutTrigger: "perAcceptedLead",
        payoutStates: [{ key: "pending", label: "Pending" }],
        initialPayoutState: "pending",
      });
      const planId = await ctx.db.insert("plans", {
        supplierId,
        name: "CTO Plan",
        planType: "fixed",
      });
      const planVersionId = await ctx.db.insert("planVersions", {
        planId,
        effectiveFrom: 0,
        effectiveTo: null,
        discountPercent: 5,
        benefitDelivery: "billDiscount",
        weekdayWindowOnly: false,
        eligibility: {
          requiresSmartMeter: false,
          membershipRequired: null,
          residentialOnly: true,
          coverageAreas: [],
        },
      });
      return { supplierId, planVersionId };
    },
  );

  const recommendationId = await t.run(async (ctx) => {
    const homeProfileId = await ctx.db.insert("homeProfiles", {
      sessionId,
      hasSmartMeter: "unknown",
      bundleMemberships: [],
      placeOfResidence: { he: "תל אביב" },
      currentSupplierId: null,
      currentPlanId: null,
      approximateMonthlyKwh: null,
      workFromHome: "sometimes",
      hasEv: false,
      evChargingTime: null,
      washerDryerTime: null,
      acUsageLevel: "moderate",
      willingToShiftUsage: false,
      willingToAcceptOffBillBenefits: true,
    });
    const iecRateId = await ctx.db.insert("iecRates", {
      rateAgorotPerKwh: 64.32,
      effectiveFrom: 0,
      effectiveTo: null,
    });
    const recommendationId = await ctx.db.insert("recommendations", {
      sessionId,
      homeProfileId,
      billImportId: null,
      confidenceLevel: "high",
      iecRateId,
      baselineAnnualCostAgorot: 0,
      taozBaselineAnnualCostAgorot: null,
      primaryPlanVersionId: referredPlanVersionId,
      primaryAnnualSavingsAgorot: 0,
      noChangePlanVersionId: referredPlanVersionId,
      noChangePlanAnnualSavingsAgorot: 0,
      showNoChangeSeparately: false,
      assumptions: "[]",
      shareCode: null,
    });
    await ctx.db.insert("evaluatedPlanVersions", {
      recommendationId,
      planVersionId: referredPlanVersionId,
      annualSavingsAgorot: 100,
      isEligible: true,
      ineligibilityReason: null,
    });
    await ctx.db.insert("evaluatedPlanVersions", {
      recommendationId,
      planVersionId: otherPlanVersionId,
      annualSavingsAgorot: 200,
      isEligible: true,
      ineligibilityReason: null,
    });
    await ctx.db.insert("evaluatedPlanVersions", {
      recommendationId,
      planVersionId: clickThroughOnlyPlanVersionId,
      annualSavingsAgorot: 300,
      isEligible: true,
      ineligibilityReason: null,
    });
    // Ineligible plan version for otherSupplierId should not appear either.
    const ineligiblePlanId = await ctx.db.insert("plans", {
      supplierId: otherSupplierId,
      name: "Ineligible Plan",
      planType: "day",
    });
    const ineligiblePlanVersionId = await ctx.db.insert("planVersions", {
      planId: ineligiblePlanId,
      effectiveFrom: 0,
      effectiveTo: null,
      discountPercent: 15,
      benefitDelivery: "billDiscount",
      weekdayWindowOnly: false,
      eligibility: {
        requiresSmartMeter: true,
        membershipRequired: null,
        residentialOnly: true,
        coverageAreas: [],
      },
    });
    await ctx.db.insert("evaluatedPlanVersions", {
      recommendationId,
      planVersionId: ineligiblePlanVersionId,
      annualSavingsAgorot: 0,
      isEligible: false,
      ineligibilityReason: null,
    });
    return recommendationId;
  });

  const scope = await t.query(api.leads.getFanOutScope, {
    sessionId,
    recommendationId,
    excludeSupplierId: referredSupplierId,
  });

  expect(scope).toEqual([
    { supplierId: otherSupplierId, planVersionId: otherPlanVersionId },
  ]);
});

test("getFanOutScope without a recommendation returns every other active formHandoff supplier", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId: referredSupplierId } = await seedSupplierAndPlan(t);
  const { supplierId: otherSupplierId, planVersionId: otherPlanVersionId } =
    await seedSupplierAndPlan(t);
  const inactiveSupplierId = await t.run((ctx) =>
    ctx.db.insert("suppliers", {
      name: "Inactive Supplier",
      logoFileName: "inactiveSupplier.webp",
      isActive: false,
      supportedHandoffTypes: ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    }),
  );

  const scope = await t.query(api.leads.getFanOutScope, {
    sessionId,
    excludeSupplierId: referredSupplierId,
  });

  expect(scope).toEqual([
    { supplierId: otherSupplierId, planVersionId: otherPlanVersionId },
  ]);
  expect(scope.some((s) => s.supplierId === inactiveSupplierId)).toBe(false);
});

// ─────────────────────────────────────────────────────────────────────────────
// confirmSupplierFanOut
// ─────────────────────────────────────────────────────────────────────────────

test("confirmSupplierFanOut creates one Referral and one open delivery per fan-out entry", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId: firstSupplierId, planVersionId: firstPlanVersionId } =
    await seedSupplierAndPlan(t);
  const { supplierId: secondSupplierId, planVersionId: secondPlanVersionId } =
    await seedSupplierAndPlan(t);

  const { leadId } = await t.mutation(api.leads.submitLeadForm, {
    sessionId,
    supplierId: firstSupplierId,
    planVersionId: firstPlanVersionId,
    name: "Yossi",
    phone: "0501234567",
    email: null,
  });

  const referralIds = await t.mutation(api.leads.confirmSupplierFanOut, {
    leadId,
    fanOuts: [
      { supplierId: secondSupplierId, planVersionId: secondPlanVersionId },
    ],
  });

  expect(referralIds).toHaveLength(1);
  const referral = await t.run((ctx) =>
    ctx.db.get("referrals", referralIds[0]),
  );
  expect(referral).toMatchObject({
    leadId,
    supplierId: secondSupplierId,
    planVersionId: secondPlanVersionId,
    handoffType: "formHandoff",
  });

  const deliveries = await t.run((ctx) =>
    ctx.db
      .query("formSubmissionDeliveries")
      .withIndex("by_referral", (q) => q.eq("referralId", referralIds[0]))
      .collect(),
  );
  expect(deliveries).toHaveLength(1);
  expect(deliveries[0]).toMatchObject({ state: "open", attempts: 0 });

  // The initial referral from submitLeadForm is untouched.
  const allReferralsForLead = await t.run((ctx) =>
    ctx.db
      .query("referrals")
      .withIndex("by_lead", (q) => q.eq("leadId", leadId))
      .collect(),
  );
  expect(allReferralsForLead).toHaveLength(2);
});
