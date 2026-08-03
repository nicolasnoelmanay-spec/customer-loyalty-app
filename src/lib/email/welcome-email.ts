import { after } from "next/server";
import { loyaltyConfig } from "@/config/loyalty";
import { PRODUCTION_APP_URL } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/send-email";

/** Canonical member login link used in welcome emails. */
export const MEMBER_WELCOME_LOGIN_URL =
  `${PRODUCTION_APP_URL}/login?customer=1`;

export interface WelcomeEmailInput {
  name: string;
  email: string;
  username: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildWelcomeEmailContent(input: WelcomeEmailInput) {
  const loginUrl = MEMBER_WELCOME_LOGIN_URL;
  const brandName = loyaltyConfig.email.brandName;
  const programName = loyaltyConfig.programName;
  const subject = `Welcome to ${brandName}`;

  const text = [
    `Hi ${input.name},`,
    "",
    `Welcome to ${programName}! Your member account is ready.`,
    "",
    `Your username: ${input.username}`,
    "",
    "Here's how it works:",
    `You've received ${loyaltyConfig.registrationBonusPoints} welcome point to get started.`,
    `- Earn ${loyaltyConfig.pointsPerDrink} point for every qualifying ${loyaltyConfig.drinkLabel} (₱${loyaltyConfig.minDrinkPriceForPoints}+).`,
    `- Collect ${loyaltyConfig.voucher.pointsPerVoucher} consecutive points for a ${loyaltyConfig.voucher.label}.`,
    `- Reach ${loyaltyConfig.streak.cycleLength} consecutive points for a ${loyaltyConfig.freeDrinkVoucher.label}.`,
    "",
    "Show your member QR code at the counter when you order, or sign in anytime:",
    loginUrl,
    "",
    `See you at ${brandName}!`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.name)},</p>
    <p>Welcome to <strong>${escapeHtml(programName)}</strong>! Your member account is ready.</p>
    <p>Your username: <strong>${escapeHtml(input.username)}</strong></p>
    <p>Here's how it works:</p>
    <p>You've received <strong>${loyaltyConfig.registrationBonusPoints} welcome point</strong> to get started.</p>
    <ul>
      <li>Earn ${loyaltyConfig.pointsPerDrink} point for every qualifying ${escapeHtml(loyaltyConfig.drinkLabel)} (₱${loyaltyConfig.minDrinkPriceForPoints}+).</li>
      <li>Collect ${loyaltyConfig.voucher.pointsPerVoucher} consecutive points for a ${escapeHtml(loyaltyConfig.voucher.label)}.</li>
      <li>Reach ${loyaltyConfig.streak.cycleLength} consecutive points for a ${escapeHtml(loyaltyConfig.freeDrinkVoucher.label)}.</li>
    </ul>
    <p>
      Show your member QR code at the counter when you order, or
      <a href="${loginUrl}">sign in to your account</a> anytime.
    </p>
    <p>See you at ${escapeHtml(brandName)}!</p>
  `.trim();

  return { subject, text, html };
}

export async function sendWelcomeEmail(
  input: WelcomeEmailInput
): Promise<{ id: string } | null> {
  if (!process.env.SENDWITH_API_KEY?.trim()) {
    console.warn("Skipping welcome email: SENDWITH_API_KEY is not configured.");
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

/** Schedule a welcome email after the HTTP response finishes. */
export function scheduleWelcomeEmail(input: WelcomeEmailInput): void {
  after(() => sendWelcomeEmailSafely(input));
}
