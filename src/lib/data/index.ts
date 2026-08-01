import { LocalStorageLoyaltyRepository } from "./local-storage-repository";

export type { LoyaltyRepository } from "./types";
export { LocalStorageLoyaltyRepository } from "./local-storage-repository";

export function createLoyaltyRepository() {
  return new LocalStorageLoyaltyRepository();
}
