"use node";
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Resend } from "resend";
import nodemailer from "nodemailer";

const NOTIFICATION_RECIPIENT = "jmjpro+chisko_form@gmail.com";

export const sendDeliveryNotification = internalAction({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    const details = await ctx.runQuery(internal.leads.getReferralEmailDetails, {
      referralId: args.referralId,
    });

    const localSmtpHost = process.env.LOCAL_SMTP_HOST;
    const resendApiKey = process.env.RESEND_API_KEY;

    const text = [
      `Name: ${details.leadName}`,
      `Phone: ${details.leadPhone}`,
      `Email: ${details.leadEmail ?? "—"}`,
      `Supplier: ${details.supplierName}`,
    ].join("\n");

    const subject = `New lead for ${details.supplierName}`;

    if (localSmtpHost) {
      const transport = nodemailer.createTransport({ host: localSmtpHost, port: 1025 });
      await transport.sendMail({
        from: "Chisko Leads <leads@chisko.app>",
        to: NOTIFICATION_RECIPIENT,
        subject,
        text,
      });
    } else if (resendApiKey) {
      const resend = new Resend(resendApiKey);
      const { error } = await resend.emails.send({
        from: "Chisko Leads <leads@chisko.app>",
        to: NOTIFICATION_RECIPIENT,
        subject,
        text,
      });
      if (error) throw new Error(`Resend error: ${error.message}`);
    } else {
      console.error(
        "sendDeliveryNotification: neither LOCAL_SMTP_HOST nor RESEND_API_KEY is configured — skipping notification",
      );
    }
  },
});
