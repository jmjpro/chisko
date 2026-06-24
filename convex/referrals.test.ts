import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { seedSession, seedSupplierAndPlan } from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");

test("recordClickThrough creates a click-through Referral with a generated Click ID on first click", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t, {
    supportedHandoffTypes: ["clickThrough"],
    affiliateUrl: "https://onboarding.super-power.co.il/?refcode=abc&refid=def",
  });

  const result = await t.mutation(api.referrals.recordClickThrough, {
    sessionId,
    supplierId,
    planVersionId,
  });

  expect(result).toMatchObject({
    affiliateUrl: "https://onboarding.super-power.co.il/?refcode=abc&refid=def",
  });
  expect(result?.clickId).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);

  const referral = await t.run((ctx) =>
    ctx.db
      .query("referrals")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .first(),
  );
  expect(referral).toMatchObject({
    sessionId,
    supplierId,
    planVersionId,
    handoffType: "clickThrough",
    clickId: result?.clickId,
  });
  expect(referral?.leadId).toBeUndefined();
});

test("recordClickThrough reuses the existing Referral and Click ID on a repeat click", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t, {
    supportedHandoffTypes: ["clickThrough"],
    affiliateUrl: "https://onboarding.super-power.co.il/?refcode=abc&refid=def",
  });

  const first = await t.mutation(api.referrals.recordClickThrough, {
    sessionId,
    supplierId,
    planVersionId,
  });
  const second = await t.mutation(api.referrals.recordClickThrough, {
    sessionId,
    supplierId,
    planVersionId,
  });

  expect(second?.clickId).toBe(first?.clickId);
  expect(second?.affiliateUrl).toBe(first?.affiliateUrl);

  const referrals = await t.run((ctx) =>
    ctx.db
      .query("referrals")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect(),
  );
  expect(referrals).toHaveLength(1);
});

test("recordClickThrough returns null when the supplier doesn't support clickThrough", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t, {
    supportedHandoffTypes: ["formHandoff"],
    affiliateUrl: "https://onboarding.super-power.co.il/?refcode=abc&refid=def",
  });

  const result = await t.mutation(api.referrals.recordClickThrough, {
    sessionId,
    supplierId,
    planVersionId,
  });

  expect(result).toBeNull();
  const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
  expect(referrals).toHaveLength(0);
});

test("recordClickThrough returns null when the plan version has no affiliateUrl", async () => {
  const t = convexTest(schema, modules);
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t, {
    supportedHandoffTypes: ["clickThrough"],
  });

  const result = await t.mutation(api.referrals.recordClickThrough, {
    sessionId,
    supplierId,
    planVersionId,
  });

  expect(result).toBeNull();
  const referrals = await t.run((ctx) => ctx.db.query("referrals").collect());
  expect(referrals).toHaveLength(0);
});
