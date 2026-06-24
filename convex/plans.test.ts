import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedSupplierAndPlan } from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");

async function seedSupplierWithPlans(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => {
    const supplierId = await ctx.db.insert("suppliers", {
      name: "Acme Power",
      logoFileName: "acme.webp",
      isActive: true,
      supportedHandoffTypes: ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    });

    const activeFixedPlanId = await ctx.db.insert("plans", {
      supplierId,
      name: "Acme Fixed",
      planType: "fixed",
    });
    await ctx.db.insert("planVersions", {
      planId: activeFixedPlanId,
      effectiveFrom: 0,
      effectiveTo: null,
      discountPercent: 7,
      benefitDelivery: "billDiscount",
      weekdayWindowOnly: false,
      eligibility: {
        requiresSmartMeter: false,
        membershipRequired: null,
        residentialOnly: true,
        coverageAreas: [],
      },
    });

    const retiredPlanId = await ctx.db.insert("plans", {
      supplierId,
      name: "Acme Retired",
      planType: "fixed",
    });
    await ctx.db.insert("planVersions", {
      planId: retiredPlanId,
      effectiveFrom: 0,
      effectiveTo: 100, // no longer active
      discountPercent: 3,
      benefitDelivery: "billDiscount",
      weekdayWindowOnly: false,
      eligibility: {
        requiresSmartMeter: false,
        membershipRequired: null,
        residentialOnly: true,
        coverageAreas: [],
      },
    });

    const otherSupplierId = await ctx.db.insert("suppliers", {
      name: "Other Co",
      logoFileName: "other.webp",
      isActive: true,
      supportedHandoffTypes: ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    });
    const otherPlanId = await ctx.db.insert("plans", {
      supplierId: otherSupplierId,
      name: "Other Fixed",
      planType: "fixed",
    });
    await ctx.db.insert("planVersions", {
      planId: otherPlanId,
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

    return { supplierId, activeFixedPlanId, retiredPlanId, otherSupplierId };
  });
}

test("listForSupplier returns only plans of the given supplier with an active plan version", async () => {
  const t = convexTest(schema, modules);
  const { supplierId, activeFixedPlanId, retiredPlanId } =
    await seedSupplierWithPlans(t);

  const plans = await t.query(api.plans.listForSupplier, { supplierId });

  expect(plans).toHaveLength(1);
  expect(plans[0]).toMatchObject({
    _id: activeFixedPlanId,
    name: "Acme Fixed",
    planType: "fixed",
  });
  expect(plans.some((p) => p._id === retiredPlanId)).toBe(false);
});

test("listForSupplier returns an empty list for a supplier with no plans", async () => {
  const t = convexTest(schema, modules);
  const supplierId = await t.run(async (ctx) =>
    ctx.db.insert("suppliers", {
      name: "No Plans Co",
      logoFileName: "noplans.webp",
      isActive: true,
      supportedHandoffTypes: ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    }),
  );

  const plans = await t.query(api.plans.listForSupplier, { supplierId });

  expect(plans).toHaveLength(0);
});

test("listActive includes the supplierId for each row, for lead-capture CTA wiring", async () => {
  const t = convexTest(schema, modules);
  const { supplierId } = await seedSupplierAndPlan(t);

  const rows = await t.query(api.plans.listActive, {});

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ supplierId, supplierName: "Test Supplier" });
});

test("listActive includes supportedHandoffTypes for each row, for the click-through CTA gate", async () => {
  const t = convexTest(schema, modules);
  await seedSupplierAndPlan(t, {
    supportedHandoffTypes: ["clickThrough", "formHandoff"],
  });

  const rows = await t.query(api.plans.listActive, {});

  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    supportedHandoffTypes: ["clickThrough", "formHandoff"],
  });
});
