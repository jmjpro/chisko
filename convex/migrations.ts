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
