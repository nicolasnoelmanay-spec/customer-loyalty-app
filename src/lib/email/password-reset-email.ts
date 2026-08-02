import { loyaltyConfig } from "@/config/loyalty";
import { PRODUCTION_APP_URL } from "@/lib/email/app-url";
import { PASSWORD_RESET_TOKEN_HOURS } from "@/lib/auth/password-reset-token";
import { sendEmail } from "@/lib/email/send-email";

export interface PasswordResetEmailInput {
  name: string;
  email: string;
  token: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPasswordResetEmailContent(input: PasswordResetEmailInput) {
  const brandName = loyaltyConfig.email.brandName;
  const resetUrl = `${PRODUCTION_APP_URL}/login?reset=1&token=${encodeURIComponent(input.token)}`;
  const subject = `Reset your ${brandName} password`;

  const text = [
    `Hi ${input.name},`,
    "",
    `We received a request to reset your ${brandName} account password.`,
    "",
    `Reset your password using this link (expires in ${PASSWORD_RESET_TOKEN_HOURS} hour):`,
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    `See you at ${brandName}!`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.name)},</p>
    <p>We received a request to reset your <strong>${escapeHtml(brandName)}</strong> account password.</p>
    <p>
      <a href="${resetUrl}">Reset your password</a>
      (link expires in ${PASSWORD_RESET_TOKEN_HOURS} hour).
    </p>
    <p>If you did not request this, you can ignore this email.</p>
    <p>See you at ${escapeHtml(brandName)}!</p>
  `.trim();

  return { subject, text, html };
}

export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput
): Promise<{ id: string } | null> {
  if (!process.env.SENDWITH_API_KEY?.trim()) {
    return null;
  }

  const { subject, text, html } = buildPasswordResetEmailContent(input);

  return sendEmail({
    to: input.email,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetEmailSafely(
  input: PasswordResetEmailInput
): Promise<void> {
  try {
    await sendPasswordResetEmail(input);
  } catch (error) {
    console.error("Failed to send password reset email.", error);
  }
}
