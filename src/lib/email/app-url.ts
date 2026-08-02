/** Canonical production site used for email and QR links. */
export const PRODUCTION_APP_URL =
  "https://loyaltyprogram.coffeesentials.online";

/**
 * Absolute app origin for links in emails and similar server-side URLs.
 * Prefers explicit env, then Vercel hostnames, then the production domain
 * (never localhost — reset/login links must work in the recipient's browser).
 */
export function getAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit && !isLocalHost(explicit)) return normalizeOrigin(explicit);

  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (productionHost && !isLocalHost(productionHost)) {
    return normalizeOrigin(productionHost);
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel && !isLocalHost(vercel)) return normalizeOrigin(vercel);

  return PRODUCTION_APP_URL;
}

function isLocalHost(value: string): boolean {
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?\/?$/i.test(
    value.trim()
  );
}

function normalizeOrigin(value: string): string {
  const trimmed = value.replace(/\/$/, "");
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
