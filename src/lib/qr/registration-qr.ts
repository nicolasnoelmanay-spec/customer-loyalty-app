import { loyaltyConfig } from "@/config/loyalty";
import { getAppUrl } from "@/lib/email/app-url";

export const MEMBER_REGISTRATION_PATH = "/login?join=1";

export function getMemberRegistrationQrTitle(): string {
  return `Scan The Code To Join The ${loyaltyConfig.programName}`;
}

export function getMemberRegistrationUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const base = configured
    ? configured.replace(/\/$/, "")
    : typeof window !== "undefined"
      ? window.location.origin
      : getAppUrl();

  return `${base}${MEMBER_REGISTRATION_PATH}`;
}
