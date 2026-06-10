import { query } from "./_generated/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("suppliers").collect();
    return all.filter((s) => s.isActive);
  },
});
