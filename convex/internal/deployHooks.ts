import { internalAction } from "../_generated/server";

export const triggerVercel = internalAction({
  args: {},
  handler: async () => {
    const hookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!hookUrl) return null;
    await fetch(hookUrl, { method: "POST" });
    return null;
  },
});
