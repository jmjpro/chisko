import { internalMutation } from "./_generated/server";

/**
 * One-time backfill: sets benefitDelivery on all planVersions that predate
 * the field, and willingToAcceptOffBillBenefits on all homeProfiles that do.
 * After running, narrow both fields to required in schema.ts.
 */
export const backfillBenefitFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const pvs = await ctx.db.query("planVersions").collect();
    let pvPatched = 0;
    for (const pv of pvs) {
      if (pv.benefitDelivery !== undefined) continue;
      const plan = await ctx.db.get("plans", pv.planId);
      if (plan?.name === "Pazgaz Yellow Accumulation") {
        await ctx.db.patch("planVersions", pv._id, {
          benefitDelivery: "appCredit",
          annualSavingsCapAgorot: 60000,
        });
      } else {
        await ctx.db.patch("planVersions", pv._id, {
          benefitDelivery: "billDiscount",
        });
      }
      pvPatched++;
    }

    const profiles = await ctx.db.query("homeProfiles").collect();
    let profilesPatched = 0;
    for (const profile of profiles) {
      if (profile.willingToAcceptOffBillBenefits !== undefined) continue;
      await ctx.db.patch("homeProfiles", profile._id, {
        willingToAcceptOffBillBenefits: true,
      });
      profilesPatched++;
    }

    return { pvPatched, profilesPatched };
  },
});

/**
 * One-time backfill: corrects supportedHandoffTypes on already-seeded
 * supplier rows (CHI-71). All suppliers support formHandoff; only Electra
 * additionally supports clickThrough. Run once per deployment, then drop.
 */
export const backfillSupplierHandoffTypes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const suppliers = await ctx.db.query("suppliers").collect();
    let patched = 0;
    for (const supplier of suppliers) {
      const supportedHandoffTypes =
        supplier.name === "Electra Power"
          ? (["clickThrough", "formHandoff"] as const)
          : (["formHandoff"] as const);
      await ctx.db.patch("suppliers", supplier._id, {
        supportedHandoffTypes: [...supportedHandoffTypes],
      });
      patched++;
    }
    return { patched };
  },
});
