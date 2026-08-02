import { loyaltyConfig } from "@/config/loyalty";
import { getAppUrl } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/send-email";

export interface WelcomeEmailInput {
  name: string;
  email: string;
  username: string;
}

function buildWelcomeEmailContent(input: WelcomeEmailInput) {
  const loginUrl = `${getAppUrl()}/customer/login`;
  const subject = `Welcome to ${loyaltyConfig.programName}`;

  const text = [
    `Hi ${input.name},`,
    "",
    `Thanks for joining ${loyaltyConfig.programName}.`,
    "",
    `Your member username is ${input.username}.`,
    `Sign in anytime at ${loginUrl} to view your points and vouchers.`,
    "",
    "See you at Coffeesentials!",
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.name)},</p>
    <p>Thanks for joining <strong>${escapeHtml(loyaltyConfig.programName)}</strong>.</p>
    <p>Your member username is <strong>${escapeHtml(input.username)}</strong>.</p>
    <p>
      <a href="${loginUrl}">Sign in to your account</a>
      to view your points and vouchers.
    </p>
    <p>See you at Coffeesentials!</p>
  `.trim();

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendWelcomeEmail(
  input: WelcomeEmailInput
): Promise<{ id: string } | null> {
  if (!process.env.RESEND_API_KEY?.trim()) {
    return null;
  }

  const { subject, text, html } = buildWelcomeEmailContent(input);

  return sendEmail({
    to: input.email,
    subject,
    text,
    html,
  });
}

export async function sendWelcomeEmailSafely(
  input: WelcomeEmailInput
): Promise<void> {
  try {
    await sendWelcomeEmail(input);
  } catch (error) {
    console.error("Failed to send welcome email.", error);
  }
}
