import { query } from "./_generated/server";

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
          supplierId: supplier._id,
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
