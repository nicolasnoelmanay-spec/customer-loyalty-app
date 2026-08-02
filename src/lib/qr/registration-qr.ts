import { loyaltyConfig } from "@/config/loyalty";
import { PRODUCTION_APP_URL } from "@/lib/email/app-url";

export const MEMBER_REGISTRATION_PATH = "/login?join=1";

export function getMemberRegistrationQrTitle(): string {
  return `Scan The Code To Join The ${loyaltyConfig.programName}`;
}

/**
 * Join URL encoded in registration QR codes.
 * Always uses the production domain so downloaded/printed codes work for
 * customers (never localhost or a preview deployment origin).
 */
export function getMemberRegistrationUrl(): string {
  return `${PRODUCTION_APP_URL}${MEMBER_REGISTRATION_PATH}`;
}
