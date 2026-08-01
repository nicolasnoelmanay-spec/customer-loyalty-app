import { loyaltyConfig } from "@/config/loyalty";

const CUSTOMER_ID_PATTERN = /^cust-[a-z0-9-]+$/i;

export function buildCustomerQrPayload(customerId: string): string {
  return `${loyaltyConfig.qr.prefix}${customerId}`;
}

export function parseCustomerQrPayload(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith(loyaltyConfig.qr.prefix)) {
    const customerId = value.slice(loyaltyConfig.qr.prefix.length).trim();
    return CUSTOMER_ID_PATTERN.test(customerId) ? customerId : null;
  }

  try {
    const url = new URL(value);
    const fromPath = url.pathname.split("/").filter(Boolean).pop();
    if (fromPath && CUSTOMER_ID_PATTERN.test(fromPath)) {
      return fromPath;
    }

    const fromQuery =
      url.searchParams.get("customer") ??
      url.searchParams.get("customerId") ??
      url.searchParams.get("id");
    if (fromQuery && CUSTOMER_ID_PATTERN.test(fromQuery)) {
      return fromQuery;
    }
  } catch {
    // Not a URL — fall through to raw ID check.
  }

  if (CUSTOMER_ID_PATTERN.test(value)) {
    return value;
  }

  return null;
}
