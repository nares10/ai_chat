import 'dotenv/config';
import { Resend } from "resend";
import { CODE_TTL_MS } from "@/lib/verification";

const DEFAULT_FROM = "onboarding@resend.dev";

/**
 * "resend" delivers real email, "console" logs the message instead.
 * Without AUTH_EMAIL_TRANSPORT set, we deliver only when an API key exists so
 * local development and the test suite work without credentials.
 */
export function emailTransport(): "resend" | "console" {
  const configured = process.env.AUTH_EMAIL_TRANSPORT;

  if (configured === "resend" || configured === "console") {
    return configured;
  }

  return process.env.RESEND_API_KEY ? "resend" : "console";
}

/**
 * The console transport has no inbox to read, so the API may hand the code back
 * to the caller instead. Never outside development.
 */
export function canRevealCode() {
  return emailTransport() === "console" && process.env.NODE_ENV !== "production";
}

export async function sendVerificationCodeEmail(params: {
  to: string;
  name: string;
  code: string;
}) {
  const minutes = Math.round(CODE_TTL_MS / 60000);
  const subject = `${params.code} is your verification code`;

  if (emailTransport() === "console") {
    console.log(
      `[email:console] verification code for ${params.to}: ${params.code} (expires in ${minutes} minutes)`
    );
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const result = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || DEFAULT_FROM,
    to: params.to,
    subject,
    html: `
      <div style="font-family: system-ui, sans-serif; line-height: 1.6; color: #18181b;">
        <p>Hi ${escapeHtml(params.name)},</p>
        <p>Use this code to verify your email address:</p>
        <p style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 24px 0;">
          ${params.code}
        </p>
        <p>The code expires in ${minutes} minutes. If you did not request it, you can ignore this email.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
