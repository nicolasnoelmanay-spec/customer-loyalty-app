import type { LoyaltyData } from "@/types";
import {
  NON_MEMBER_CUSTOMER_ID,
  NON_MEMBER_CUSTOMER_NAME,
} from "@/lib/data/non-member";

export const seedData: LoyaltyData = {
  customers: [
    {
      id: NON_MEMBER_CUSTOMER_ID,
      name: NON_MEMBER_CUSTOMER_NAME,
      phone: "N/A",
      email: "nonmember@coffeesentials.local",
      username: "customer2",
      points: 0,
      totalPointsEarned: 0,
      consecutivePointsEarned: 0,
      vouchersAvailable: 0,
      freeDrinkVouchersAvailable: 0,
      totalVouchersEarned: 0,
      totalFreeDrinkVouchersEarned: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
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
