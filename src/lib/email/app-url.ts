/** Canonical public site used in customer-facing emails and QR links. */
export const PRODUCTION_APP_URL = "https://coffeesentials.online";

export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  return "http://localhost:3000";
}

/** Prefer the production domain for links members receive by email. */
export function getPublicAppUrl(): string {
  return PRODUCTION_APP_URL;
}
