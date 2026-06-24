import {
  internalQuery,
  mutation,
  query,
  MutationCtx,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

async function createFormHandoffReferral(
  ctx: MutationCtx,
  leadId: Id<"leads">,
  supplierId: Id<"suppliers">,
  planVersionId: Id<"planVersions">,
): Promise<Id<"referrals">> {
  const supplier = await ctx.db.get("suppliers", supplierId);
  const referralId = await ctx.db.insert("referrals", {
    leadId,
    supplierId,
    planVersionId,
    handoffType: "formHandoff",
    consentGivenAt: Date.now(),
    payoutState: supplier!.initialPayoutState,
    payoutStateUpdatedAt: Date.now(),
  });
  await ctx.db.insert("formSubmissionDeliveries", {
    referralId,
    state: "open",
    attempts: 0,
    processingStartedAt: null,
  });
  return referralId;
}

export const submitLeadForm = mutation({
  args: {
    sessionId: v.id("sessions"),
    recommendationId: v.optional(v.id("recommendations")),
    supplierId: v.id("suppliers"),
    planVersionId: v.id("planVersions"),
    name: v.string(),
    phone: v.string(),
    email: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const leadId = await ctx.db.insert("leads", {
      sessionId: args.sessionId,
      recommendationId: args.recommendationId,
      name: args.name,
      phone: args.phone,
      email: args.email,
    });

    const referralId = await createFormHandoffReferral(
      ctx,
      leadId,
      args.supplierId,
      args.planVersionId,
    );

    return { leadId, referralId };
  },
});

export const confirmSupplierFanOut = mutation({
  args: {
    leadId: v.id("leads"),
    fanOuts: v.array(
      v.object({
        supplierId: v.id("suppliers"),
        planVersionId: v.id("planVersions"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const referralIds: Id<"referrals">[] = [];
    for (const fanOut of args.fanOuts) {
      referralIds.push(
        await createFormHandoffReferral(
          ctx,
          args.leadId,
          fanOut.supplierId,
          fanOut.planVersionId,
        ),
      );
    }
    return referralIds;
  },
});

async function getAlreadyReferredSupplierIds(
  ctx: QueryCtx,
  sessionId: Id<"sessions">,
): Promise<Set<Id<"suppliers">>> {
  const leads = await ctx.db
    .query("leads")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  const supplierIds = new Set<Id<"suppliers">>();
  for (const lead of leads) {
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_lead", (q) => q.eq("leadId", lead._id))
      .collect();
    for (const referral of referrals) {
      supplierIds.add(referral.supplierId);
    }
  }

  // Click-through Referrals have no Lead — they're tied to the session
  // directly, so they need their own lookup to be excluded from Fan-Out.
  const sessionReferrals = await ctx.db
    .query("referrals")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const referral of sessionReferrals) {
    supplierIds.add(referral.supplierId);
  }

  return supplierIds;
}

async function supportsFormHandoff(
  ctx: QueryCtx,
  supplierId: Id<"suppliers">,
): Promise<boolean> {
  const supplier = await ctx.db.get("suppliers", supplierId);
  return (
    supplier !== null &&
    supplier.isActive &&
    supplier.supportedHandoffTypes.includes("formHandoff")
  );
}

export const getFanOutScope = query({
  args: {
    sessionId: v.id("sessions"),
    recommendationId: v.optional(v.id("recommendations")),
    excludeSupplierId: v.id("suppliers"),
  },
  handler: async (ctx, args) => {
    const alreadyReferredSupplierIds = await getAlreadyReferredSupplierIds(
      ctx,
      args.sessionId,
    );
    alreadyReferredSupplierIds.add(args.excludeSupplierId);

    const bestPerSupplier = new Map<
      Id<"suppliers">,
      { planVersionId: Id<"planVersions">; annualSavingsAgorot: number }
    >();

    if (args.recommendationId !== undefined) {
      const evaluated = await ctx.db
        .query("evaluatedPlanVersions")
        .withIndex("by_recommendation", (q) =>
          q.eq("recommendationId", args.recommendationId!),
        )
        .collect();

      for (const evaluation of evaluated) {
        if (!evaluation.isEligible) continue;
        const planVersion = await ctx.db.get(
          "planVersions",
          evaluation.planVersionId,
        );
        if (!planVersion) continue;
        const plan = await ctx.db.get("plans", planVersion.planId);
        if (!plan) continue;
        if (alreadyReferredSupplierIds.has(plan.supplierId)) continue;
        if (!(await supportsFormHandoff(ctx, plan.supplierId))) continue;

        const existing = bestPerSupplier.get(plan.supplierId);
        if (
          !existing ||
          evaluation.annualSavingsAgorot > existing.annualSavingsAgorot
        ) {
          bestPerSupplier.set(plan.supplierId, {
            planVersionId: evaluation.planVersionId,
            annualSavingsAgorot: evaluation.annualSavingsAgorot,
          });
        }
      }
    } else {
      const suppliers = await ctx.db.query("suppliers").collect();
      for (const supplier of suppliers) {
        if (alreadyReferredSupplierIds.has(supplier._id)) continue;
        if (!supplier.isActive) continue;
        if (!supplier.supportedHandoffTypes.includes("formHandoff")) continue;

        const fixedPlan = await ctx.db
          .query("plans")
          .withIndex("by_supplier_and_type", (q) =>
            q.eq("supplierId", supplier._id).eq("planType", "fixed"),
          )
          .first();
        if (!fixedPlan) continue;
        const planVersions = await ctx.db
          .query("planVersions")
          .withIndex("by_plan", (q) => q.eq("planId", fixedPlan._id))
          .collect();
        const planVersion = planVersions.find((pv) => pv.effectiveTo === null);
        if (!planVersion) continue;

        bestPerSupplier.set(supplier._id, {
          planVersionId: planVersion._id,
          annualSavingsAgorot: 0,
        });
      }
    }

    const result = [];
    for (const [supplierId, { planVersionId }] of bestPerSupplier.entries()) {
      const supplier = await ctx.db.get("suppliers", supplierId);
      if (!supplier) continue;
      result.push({
        supplierId,
        planVersionId,
        supplierName: supplier.name,
        logoFileName: supplier.logoFileName,
      });
    }
    return result;
  },
});

export const getReferralEmailDetails = internalQuery({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const referral = await ctx.db.get("referrals", args.referralId);
    if (!referral) throw new Error(`Referral ${args.referralId} not found`);
    // Only formSubmissionDeliveries rows trigger this query, and those only
    // ever exist for form-handoff Referrals, which always have a leadId.
    if (!referral.leadId)
      throw new Error(`Referral ${args.referralId} has no leadId`);
    const lead = await ctx.db.get("leads", referral.leadId);
    if (!lead) throw new Error(`Lead ${referral.leadId} not found`);
    const supplier = await ctx.db.get("suppliers", referral.supplierId);
    if (!supplier) throw new Error(`Supplier ${referral.supplierId} not found`);

    return {
      leadName: lead.name,
      leadPhone: lead.phone,
      leadEmail: lead.email,
      supplierName: supplier.name,
    };
  },
});
