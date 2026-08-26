import { createHmac, timingSafeEqual } from "node:crypto";

function requireWebhookSecret(): string {
  const value = process.env.PAYMONGO_WEBHOOK_SECRET?.trim();
  if (!value) {
    throw new Error("PAYMONGO_WEBHOOK_SECRET is not configured.");
  }
  return value;
}

export function parsePaymongoSignatureHeader(header: string | null): {
  timestamp: string;
  testSignature: string;
  liveSignature: string;
} | null {
  if (!header?.trim()) return null;

  const parts = Object.fromEntries(
    header.split(",").map((segment) => {
      const [key, ...rest] = segment.trim().split("=");
      return [key, rest.join("=")];
    })
  );

  const timestamp = parts.t?.trim() ?? "";
  if (!timestamp) return null;

  return {
    timestamp,
    testSignature: parts.te?.trim() ?? "",
    liveSignature: parts.li?.trim() ?? "",
  };
}

function signaturesMatch(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(actual, "utf8");
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

/** Verify PayMongo webhook HMAC signature (test `te` or live `li`). */
export function verifyPaymongoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): boolean {
  const parsed = parsePaymongoSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const secret = requireWebhookSecret();
  const payload = `${parsed.timestamp}.${rawBody}`;
  const computed = createHmac("sha256", secret).update(payload).digest("hex");

  return (
    signaturesMatch(computed, parsed.testSignature) ||
    signaturesMatch(computed, parsed.liveSignature)
  );
}
