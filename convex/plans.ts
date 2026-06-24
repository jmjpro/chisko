import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Plans of a given supplier that currently have an active plan version —
 * powers the Current Plan Baseline picker (ADR-0024).
 */
export const listForSupplier = query({
  args: { supplierId: v.id("suppliers") },
  handler: async (ctx, { supplierId }) => {
    const plans = await ctx.db
      .query("plans")
      .withIndex("by_supplier", (q) => q.eq("supplierId", supplierId))
      .collect();

    const activePvs = await ctx.db
      .query("planVersions")
      .withIndex("by_effective_to", (q) => q.eq("effectiveTo", null))
      .collect();
    const activePlanIds = new Set(activePvs.map((pv) => pv.planId));

    return plans
      .filter((p) => activePlanIds.has(p._id))
      .map((p) => ({ _id: p._id, name: p.name, planType: p.planType }));
  },
});

export const listActive = query({
  args: {},
  handler: async (ctx) => {
    const planVersions = await ctx.db
      .query("planVersions")
      .withIndex("by_effective_to", (q) => q.eq("effectiveTo", null))
      .collect();

    const rows = await Promise.all(
      planVersions.map(async (pv) => {
        const plan = await ctx.db.get("plans", pv.planId);
        if (!plan) return null;
        const supplier = await ctx.db.get("suppliers", plan.supplierId);
        if (!supplier) return null;
        return {
          pvId: pv._id,
          supplierName: supplier.name,
          planName: plan.name,
          planType: plan.planType,
          discountPercent: pv.discountPercent,
          discountWindowStartHour: pv.discountWindowStartHour ?? null,
          discountWindowEndHour: pv.discountWindowEndHour ?? null,
          weekdayWindowOnly: pv.weekdayWindowOnly,
        };
      }),
    );

    return rows
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort(
        (a, b) =>
          a.supplierName.localeCompare(b.supplierName) ||
          a.planName.localeCompare(b.planName),
      );
  },
});
