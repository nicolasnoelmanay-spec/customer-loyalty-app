import { loyaltyConfig } from "@/config/loyalty";
import { getAppUrl } from "@/lib/email/app-url";
import { sendEmail } from "@/lib/email/send-email";

export interface VoucherEarnedEmailInput {
  name: string;
  email: string;
  halfOffVouchersEarned: number;
  freeDrinkVouchersEarned: number;
  vouchersAvailable: number;
  freeDrinkVouchersAvailable: number;
  pointsBalance: number;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatVoucherCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function buildVoucherEarnedEmailContent(input: VoucherEarnedEmailInput) {
  const loginUrl = `${getAppUrl()}/customer/login`;
  const brandName = loyaltyConfig.email.brandName;
  const earnedParts: string[] = [];

  if (input.halfOffVouchersEarned > 0) {
    earnedParts.push(
      formatVoucherCount(
        input.halfOffVouchersEarned,
        loyaltyConfig.voucher.label
      )
    );
  }

  if (input.freeDrinkVouchersEarned > 0) {
    earnedParts.push(
      formatVoucherCount(
        input.freeDrinkVouchersEarned,
        loyaltyConfig.freeDrinkVoucher.label
      )
    );
  }

  const earnedSummary = earnedParts.join(" and ");
  const subject =
    input.halfOffVouchersEarned + input.freeDrinkVouchersEarned === 1
      ? `You earned a voucher at ${brandName}`
      : `You earned vouchers at ${brandName}`;

  const text = [
    `Hi ${input.name},`,
    "",
    `Congratulations! You just earned ${earnedSummary}.`,
    "",
    `Your current balance:`,
    `- Points: ${input.pointsBalance.toLocaleString()}`,
    `- 50% off vouchers available: ${input.vouchersAvailable}`,
    `- Free drink vouchers available: ${input.freeDrinkVouchersAvailable}`,
    "",
    `Redeem your vouchers on your next visit. Sign in at ${loginUrl} to view your account.`,
    "",
    `See you at ${brandName}!`,
  ].join("\n");

  const html = `
    <p>Hi ${escapeHtml(input.name)},</p>
    <p>Congratulations! You just earned <strong>${escapeHtml(earnedSummary)}</strong>.</p>
    <p>Your current balance:</p>
    <ul>
      <li>Points: <strong>${input.pointsBalance.toLocaleString()}</strong></li>
      <li>50% off vouchers available: <strong>${input.vouchersAvailable}</strong></li>
      <li>Free drink vouchers available: <strong>${input.freeDrinkVouchersAvailable}</strong></li>
    </ul>
    <p>
      Redeem your vouchers on your next visit.
      <a href="${loginUrl}">Sign in to your account</a> to view your balance.
    </p>
    <p>See you at ${escapeHtml(brandName)}!</p>
  `.trim();

  return { subject, text, html };
}

export async function sendVoucherEarnedEmail(
  input: VoucherEarnedEmailInput
): Promise<{ id: string } | null> {
  if (!process.env.SENDWITH_API_KEY?.trim()) {
    return null;
  }

  if (input.halfOffVouchersEarned <= 0 && input.freeDrinkVouchersEarned <= 0) {
    return null;
  }

  const { subject, text, html } = buildVoucherEarnedEmailContent(input);

  return sendEmail({
    to: input.email,
    subject,
    text,
    html,
  });
}

export async function sendVoucherEarnedEmailSafely(
  input: VoucherEarnedEmailInput
): Promise<void> {
  try {
    await sendVoucherEarnedEmail(input);
  } catch (error) {
    console.error("Failed to send voucher earned email.", error);
  }
}
