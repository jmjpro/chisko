import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Same alphabet/length as Recommendation share codes (convex/recommendations.ts).
const CLICK_ID_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CLICK_ID_LENGTH = 6;

function makeClickId(): string {
  let id = "";
  for (let i = 0; i < CLICK_ID_LENGTH; i++) {
    id +=
      CLICK_ID_ALPHABET[Math.floor(Math.random() * CLICK_ID_ALPHABET.length)];
  }
  return id;
}

/**
 * Records (or reuses) a click-through Referral for a session+supplier+plan
 * version and returns the outbound affiliate URL to redirect to. Idempotent
 * per ADR-0027: re-clicking within the same session reuses the existing
 * Referral's Click ID rather than minting a new one.
 */
export const recordClickThrough = mutation({
  args: {
    sessionId: v.id("sessions"),
    supplierId: v.id("suppliers"),
    planVersionId: v.id("planVersions"),
  },
  handler: async (ctx, args) => {
    const supplier = await ctx.db.get("suppliers", args.supplierId);
    if (!supplier || !supplier.supportedHandoffTypes.includes("clickThrough")) {
      return null;
    }

    const planVersion = await ctx.db.get("planVersions", args.planVersionId);
    if (!planVersion || !planVersion.affiliateUrl) {
      return null;
    }

    const sessionReferrals = await ctx.db
      .query("referrals")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
    const existing = sessionReferrals.find(
      (r) =>
        r.handoffType === "clickThrough" &&
        r.supplierId === args.supplierId &&
        r.planVersionId === args.planVersionId,
    );
    if (existing) {
      return {
        clickId: existing.clickId!,
        affiliateUrl: planVersion.affiliateUrl,
      };
    }

    const clickId = makeClickId();
    await ctx.db.insert("referrals", {
      sessionId: args.sessionId,
      supplierId: args.supplierId,
      planVersionId: args.planVersionId,
      handoffType: "clickThrough",
      clickId,
      consentGivenAt: Date.now(),
      payoutState: supplier.initialPayoutState,
      payoutStateUpdatedAt: Date.now(),
    });

    return { clickId, affiliateUrl: planVersion.affiliateUrl };
  },
});
