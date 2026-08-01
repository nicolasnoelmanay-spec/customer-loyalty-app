import type { LoyaltyData } from "@/types";

export const seedData: LoyaltyData = {
  customers: [
    {
      id: "cust-001",
      name: "Nicolas Noel Manay",
      phone: "+63 917 123 4567",
      email: "nicolas.manay@email.com",
      username: "nicolas",
      points: 0,
      totalPointsEarned: 0,
      consecutivePointsEarned: 0,
      vouchersAvailable: 0,
      freeDrinkVouchersAvailable: 0,
      totalVouchersEarned: 0,
      totalFreeDrinkVouchersEarned: 0,
      createdAt: "2026-01-15T10:00:00.000Z",
    },
  ],
  transactions: [],
};
