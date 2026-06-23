import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import {
  failingFetch,
  getDeliveryByReferral,
  okFetch,
  seedSession,
  seedSupplierAndPlan,
} from "./testHelpers.shared";

const modules = import.meta.glob("./**/*.ts");

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("RESEND_API_KEY", "test_key");
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function seedOpenDelivery(t: ReturnType<typeof convexTest>) {
  const sessionId = await seedSession(t);
  const { supplierId, planVersionId } = await seedSupplierAndPlan(t);
  const { referralId } = await t.mutation(api.leads.submitLeadForm, {
    sessionId,
    supplierId,
    planVersionId,
    name: "Yossi",
    phone: "0501234567",
    email: null,
  });
  return referralId;
}

test("claimBatch marks open deliveries as processing and returns them", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);

  const now = Date.now();
  const claimed = await t.mutation(
    internal.formSubmissionDeliveries.claimBatch,
    {},
  );

  expect(claimed).toHaveLength(1);
  expect(claimed[0].referralId).toBe(referralId);

  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({ state: "processing" });
  expect(delivery!.processingStartedAt).toBe(now);
});

test("claimBatch leaves recently-claimed processing deliveries alone", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  await t.mutation(internal.formSubmissionDeliveries.claimBatch, {});

  vi.advanceTimersByTime(5 * 60 * 1000); // 5 min — under the 10 min staleness threshold
  const claimed = await t.mutation(
    internal.formSubmissionDeliveries.claimBatch,
    {},
  );

  expect(claimed).toHaveLength(0);
  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({ state: "processing" });
});

test("claimBatch reclaims stale processing deliveries past the staleness threshold", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  await t.mutation(internal.formSubmissionDeliveries.claimBatch, {});

  vi.advanceTimersByTime(10 * 60 * 1000); // exactly at the 10 min staleness threshold
  const now = Date.now();
  const claimed = await t.mutation(
    internal.formSubmissionDeliveries.claimBatch,
    {},
  );

  expect(claimed).toHaveLength(1);
  expect(claimed[0].referralId).toBe(referralId);
  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({ state: "processing" });
  expect(delivery!.processingStartedAt).toBe(now);
});

// ─────────────────────────────────────────────────────────────────────────────
// runBatch
// ─────────────────────────────────────────────────────────────────────────────

test("runBatch no-ops when ENABLE_CONVEX_CLOUD is false", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  vi.stubEnv("ENABLE_CONVEX_CLOUD", "false");
  vi.stubGlobal("fetch", okFetch());

  await t.action(internal.formSubmissionDeliveries.runBatch, {});

  expect(fetch).not.toHaveBeenCalled();
  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({ state: "open" });
});

test("runBatch closes a delivery once the notification email sends successfully", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  vi.stubGlobal("fetch", okFetch());

  await t.action(internal.formSubmissionDeliveries.runBatch, {});

  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({ state: "closed", attempts: 1 });
});

test("runBatch reverts a delivery to open with attempts incremented when the email send fails", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  vi.stubGlobal("fetch", failingFetch("invalid recipient"));

  await t.action(internal.formSubmissionDeliveries.runBatch, {});

  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({
    state: "open",
    attempts: 1,
    processingStartedAt: null,
  });
});

test("runBatch records the failure's error message on the delivery", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  vi.stubGlobal("fetch", failingFetch("invalid recipient"));

  await t.action(internal.formSubmissionDeliveries.runBatch, {});

  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery!.lastError).toBe("Resend error: invalid recipient");
});

test("runBatch permanently closes a delivery after exhausting the retry cap, with the final error retained", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  vi.stubGlobal("fetch", failingFetch("invalid recipient"));

  // 3 consecutive failed attempts (the confirmed retry cap)
  await t.action(internal.formSubmissionDeliveries.runBatch, {});
  await t.action(internal.formSubmissionDeliveries.runBatch, {});
  await t.action(internal.formSubmissionDeliveries.runBatch, {});

  const delivery = await getDeliveryByReferral(t, referralId);
  expect(delivery).toMatchObject({ state: "closed", attempts: 3 });
  expect(delivery!.lastError).toBe("Resend error: invalid recipient");
});

test("claimBatch never claims closed deliveries", async () => {
  const t = convexTest(schema, modules);
  const referralId = await seedOpenDelivery(t);
  await t.run(async (ctx) => {
    const delivery = await ctx.db
      .query("formSubmissionDeliveries")
      .withIndex("by_referral", (q) => q.eq("referralId", referralId))
      .first();
    await ctx.db.patch("formSubmissionDeliveries", delivery!._id, {
      state: "closed",
    });
  });

  vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 1 day later
  const claimed = await t.mutation(
    internal.formSubmissionDeliveries.claimBatch,
    {},
  );

  expect(claimed).toHaveLength(0);
});
