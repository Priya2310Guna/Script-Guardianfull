import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

const schema = z.object({
  email: z.string().trim().email().max(200),
  name: z.string().trim().max(80).optional(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

function html(code: string, name?: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0e0d0b;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#16140f;border:1px solid #2b2720;border-radius:12px;padding:28px">
    <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#c9a227">Smart Technology Script Vault</p>
    <h1 style="margin:14px 0 8px;font-size:22px;color:#f5f1e8">Verify your email</h1>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#a49c8c">
      ${name ? `Hi ${name}, ` : ""}use this code to finish opening your vault. It is valid for one session.
    </p>
    <p style="margin:0;font-family:monospace;font-size:30px;letter-spacing:10px;color:#c9a227">${code}</p>
    <p style="margin:22px 0 0;font-size:12px;color:#6f6858">
      If you did not request this, you can ignore this email.
    </p>
  </div>
</div>`;
}

export const sendVerificationEmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      return { sent: false as const, reason: "not_configured" as const };
    }

    const from = process.env.VAULT_EMAIL_FROM ?? "Script Vault <onboarding@resend.dev>";

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to: [data.email],
        subject: `${data.code} is your Script Vault verification code`,
        html: html(data.code, data.name),
        text: `Your Script Vault verification code is ${data.code}.`,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend gateway failed [${res.status}]: ${body}`);
      return {
        sent: false as const,
        reason: "provider_error" as const,
        detail: body.slice(0, 300),
      };
    }

    return { sent: true as const };
  });

export const sendHRConfirmationEmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ hrEmail: z.string().email(), applicantName: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      return { sent: false as const, reason: "not_configured" as const };
    }

    const from = process.env.VAULT_EMAIL_FROM ?? "Script Vault <onboarding@resend.dev>";

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to: [data.hrEmail],
        subject: `Access Verified by ${data.applicantName}`,
        html: `<p>The access request for ${data.applicantName} has been verified and completed successfully.</p>`,
        text: `The access request for ${data.applicantName} has been verified and completed successfully.`,
      }),
    });

    if (!res.ok) {
      return { sent: false as const, reason: "provider_error" as const };
    }

    return { sent: true as const };
  });

export const sendProfileViewEmail = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ ownerEmail: z.string().email(), ownerName: z.string(), visitorName: z.string(), visitTime: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const resendKey = process.env.RESEND_API_KEY;
    if (!lovableKey || !resendKey) {
      return { sent: false as const, reason: "not_configured" as const };
    }

    const from = process.env.VAULT_EMAIL_FROM ?? "Script Vault <onboarding@resend.dev>";
    const visitDate = new Date(data.visitTime).toLocaleString();

    const res = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from,
        to: [data.ownerEmail],
        subject: `Someone viewed your Script Vault profile`,
        html: `<div style="font-family:Inter,Arial,sans-serif;background:#0e0d0b;padding:32px;color:#f5f1e8;">
          <h1 style="margin:14px 0 8px;font-size:22px;color:#f5f1e8">Profile View Notification</h1>
          <p>Hi ${data.ownerName},</p>
          <p><strong>${data.visitorName}</strong> recently viewed your profile on Script Vault.</p>
          <p style="font-size:12px;color:#a49c8c">Visit time: ${visitDate}</p>
        </div>`,
        text: `Hi ${data.ownerName}, ${data.visitorName} recently viewed your profile on Script Vault at ${visitDate}.`,
      }),
    });

    if (!res.ok) {
      return { sent: false as const, reason: "provider_error" as const };
    }

    return { sent: true as const };
  });
