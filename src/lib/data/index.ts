import { LocalStorageLoyaltyRepository } from "./local-storage-repository";

export type { LoyaltyRepository } from "./types";
export { LocalStorageLoyaltyRepository } from "./local-storage-repository";

/**
 * Factory for the active data repository.
 * Swap this implementation to connect Supabase, Prisma, etc.
 */
export function createLoyaltyRepository() {
  return new LocalStorageLoyaltyRepository();
}
