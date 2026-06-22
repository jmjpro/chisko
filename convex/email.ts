import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Resend } from "resend";

const NOTIFICATION_RECIPIENT = "jmjpro+chisko_form@gmail.com";

export const sendDeliveryNotification = internalAction({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const details = await ctx.runQuery(internal.leads.getReferralEmailDetails, {
      referralId: args.referralId,
    });

    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: "Chisko Leads <leads@chisko.app>",
      to: NOTIFICATION_RECIPIENT,
      subject: `New lead for ${details.supplierName}`,
      text: [
        `Name: ${details.leadName}`,
        `Phone: ${details.leadPhone}`,
        `Email: ${details.leadEmail ?? "—"}`,
        `Supplier: ${details.supplierName}`,
      ].join("\n"),
    });

    if (error) throw new Error(`Resend error: ${error.message}`);
  },
});
