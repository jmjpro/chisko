import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { withCapturedExceptions } from "./lib/sentry";

const http = httpRouter();

http.route({
  path: "/seed",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.SEED_SECRET;
    if (!secret || req.headers.get("Authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    return withCapturedExceptions(async () => {
      const result: string = await ctx.runAction(
        internal.internal.seedAll.runAll,
        {},
      );
      return new Response(result, { status: 200 });
    });
  }),
});

export default http;
