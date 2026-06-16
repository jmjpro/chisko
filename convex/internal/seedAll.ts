import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

export const runAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const catalog: string = await ctx.runMutation(internal.seed.run, {});

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
  },
});
