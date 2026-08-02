import { createHash, randomBytes } from "crypto";

export function generatePasswordResetToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, hash: hashPasswordResetToken(raw) };
}

export function hashPasswordResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const PASSWORD_RESET_TOKEN_HOURS = 1;
