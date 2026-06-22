import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { withCapturedExceptions } from "../lib/sentry";

// Per CHI-72, the live smartMeterAddresses/Streets/Cities + israelPlaces
// data this seeds is on the order of 10-50MB (dominated by ~100k
// smartMeterAddresses rows).
const REGISTRY_STORAGE_ESTIMATE = "~10-50MB";

export const runAll = internalAction({
  args: { seedRegistries: v.boolean() },
  handler: async (ctx, { seedRegistries }) =>
    withCapturedExceptions(async () => {
      const catalog: string = await ctx.runMutation(internal.seed.run, {});

      if (!seedRegistries) {
        return `${catalog}; skipped smart-meter/israelPlaces registry seed (opt-in only on non-production deployments — pass ?seedRegistries=true to /seed to include it; approximate storage required: ${REGISTRY_STORAGE_ESTIMATE})`;
      }

      const hasSmartMeterData: boolean = await ctx.runQuery(
        internal.smartMeterRegistry.hasData,
        {},
      );
      if (!hasSmartMeterData) {
        await ctx.runAction(internal.smartMeterRegistryRefresh.doRefresh, {});
      }

      const hasIsraelPlaces: boolean = await ctx.runQuery(
        internal.israelPlaces.hasData,
        {},
      );
      if (!hasIsraelPlaces) {
        await ctx.runAction(internal.israelPlacesRefresh.doRefresh, {});
      }

      return catalog;
    }),
});
