import { internalAction } from "../_generated/server";
import { withCapturedExceptions } from "../lib/sentry";

export const triggerVercel = internalAction({
  args: {},
  handler: async () =>
    withCapturedExceptions(async () => {
      const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
      if (!hookUrl) return null;
      await fetch(hookUrl, { method: "POST" });
      return null;
    }),
});
