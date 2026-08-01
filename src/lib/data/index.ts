import { LocalStorageLoyaltyRepository } from "./local-storage-repository";

export type { LoyaltyRepository } from "./types";
export { LocalStorageLoyaltyRepository } from "./local-storage-repository";
export { getPrismaLoyaltyRepository, PrismaLoyaltyRepository } from "./prisma-repository";

/** @deprecated Client code should use API routes; kept for reference/testing. */
export function createLoyaltyRepository() {
  return new LocalStorageLoyaltyRepository();
}
