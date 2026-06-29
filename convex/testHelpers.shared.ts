import type { TestConvex } from "convex-test";
import { vi } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import type schema from "./schema";

type ConvexTestInstance = TestConvex<typeof schema>;

export async function seedSession(
  t: ConvexTestInstance,
): Promise<Id<"sessions">> {
  return t.run((ctx) =>
    ctx.db.insert("sessions", {
      sessionToken: "tok",
      expiresAt: Date.now() + 1000,
      convertedToLeadId: null,
    }),
  );
}

export async function seedSupplierAndPlan(
  t: ConvexTestInstance,
  overrides: {
    supportedHandoffTypes?: ("clickThrough" | "formHandoff" | "phoneBased")[];
    affiliateUrl?: string;
  } = {},
): Promise<{ supplierId: Id<"suppliers">; planVersionId: Id<"planVersions"> }> {
  return t.run(async (ctx) => {
    const supplierId = await ctx.db.insert("suppliers", {
      name: "Test Supplier",
      logoFileName: "testSupplier.webp",
      isActive: true,
      supportedHandoffTypes: overrides.supportedHandoffTypes ?? ["formHandoff"],
      payoutTrigger: "perAcceptedLead",
      payoutStates: [{ key: "pending", label: "Pending" }],
      initialPayoutState: "pending",
    });
    const planId = await ctx.db.insert("plans", {
      supplierId,
      name: "Test Plan",
      planType: "fixed",
    });
    const planVersionId = await ctx.db.insert("planVersions", {
      planId,
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
      affiliateUrl: overrides.affiliateUrl,
    });
    return { supplierId, planVersionId };
  });
}

export async function getDeliveryByReferral(
  t: ConvexTestInstance,
  referralId: Id<"referrals">,
): Promise<Doc<"formSubmissionDeliveries"> | null> {
  return t.run((ctx) =>
    ctx.db
      .query("formSubmissionDeliveries")
      .withIndex("by_referral", (q) => q.eq("referralId", referralId))
      .first(),
  );
}

export function okFetch() {
  return vi.fn(
    async (_url: string | URL | Request, _options?: RequestInit) => ({
      ok: true,
      json: async () => ({ id: "email_123" }),
      headers: new Headers(),
    }),
  );
}

export function failingFetch(message: string) {
  return vi.fn(
    async (_url: string | URL | Request, _options?: RequestInit) => ({
      ok: false,
      text: async () => JSON.stringify({ message }),
      headers: new Headers(),
    }),
  );
}
