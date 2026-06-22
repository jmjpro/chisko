import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const STALENESS_THRESHOLD_MS = 10 * 60 * 1000;
export const MAX_ATTEMPTS = 3;

export const claimBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const open = await ctx.db
      .query("formSubmissionDeliveries")
      .withIndex("by_state", (q) => q.eq("state", "open"))
      .collect();

    const stuck = await ctx.db
      .query("formSubmissionDeliveries")
      .withIndex("by_state", (q) => q.eq("state", "processing"))
      .collect();
    const stale = stuck.filter(
      (d) => now - d.processingStartedAt! >= STALENESS_THRESHOLD_MS,
    );

    const claimed = [];
    for (const delivery of [...open, ...stale]) {
      await ctx.db.patch("formSubmissionDeliveries", delivery._id, {
        state: "processing",
        processingStartedAt: now,
      });
      claimed.push({
        deliveryId: delivery._id,
        referralId: delivery.referralId,
      });
    }
    return claimed;
  },
});

export const markDelivered = internalMutation({
  args: { deliveryId: v.id("formSubmissionDeliveries") },
  handler: async (ctx, args) => {
    await ctx.db.patch("formSubmissionDeliveries", args.deliveryId, {
      state: "closed",
    });
  },
});

export const markFailed = internalMutation({
  args: { deliveryId: v.id("formSubmissionDeliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(
      "formSubmissionDeliveries",
      args.deliveryId,
    );
    if (!delivery) return;
    const attempts = delivery.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch("formSubmissionDeliveries", args.deliveryId, {
        state: "closed",
        attempts,
      });
    } else {
      await ctx.db.patch("formSubmissionDeliveries", args.deliveryId, {
        state: "open",
        attempts,
        processingStartedAt: null,
      });
    }
  },
});

export const runBatch = internalAction({
  args: {},
  handler: async (ctx) => {
    const claimed = await ctx.runMutation(
      internal.formSubmissionDeliveries.claimBatch,
      {},
    );
    for (const { deliveryId, referralId } of claimed) {
      try {
        await ctx.runAction(internal.email.sendDeliveryNotification, {
          referralId,
        });
        await ctx.runMutation(internal.formSubmissionDeliveries.markDelivered, {
          deliveryId,
        });
      } catch {
        await ctx.runMutation(internal.formSubmissionDeliveries.markFailed, {
          deliveryId,
        });
      }
    }
  },
});
