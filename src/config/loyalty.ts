/**
 * Loyalty program configuration.
 * Adjust pointsPerDrink here to change how points are earned.
 */
export const loyaltyConfig = {
  /** Points earned per coffee drink purchased */
  pointsPerDrink: 1,
  /** Drinks below this price (PHP) do not earn loyalty points */
  minDrinkPriceForPoints: 100,
  /** Singular label shown in the UI */
  drinkLabel: "coffee drink",
  /** Plural label shown in the UI */
  drinkLabelPlural: "coffee drinks",
  /** Currency denomination */
  currency: {
    code: "PHP",
    symbol: "₱",
    name: "peso",
    namePlural: "pesos",
    locale: "en-PH",
  },
  /** Display name for the program */
  programName: "Coffeesentials Loyalty Program",
  /** Outbound email sender (must be connected in SendWith) */
  email: {
    fromName: "Coffeesentials",
    fromAddress: "nicolasnoelmanay@gmail.com",
  },
  /** Consecutive earn streak: 50% off at 7, free drink at 14, then reset */
  streak: {
    cycleLength: 14,
    halfOffAt: 7,
  },
  /** 50% off voucher — earned at 7th consecutive point */
  voucher: {
    pointsPerVoucher: 7,
    label: "50% off voucher",
    earnReason: "Earned 50% off voucher (7th consecutive point)",
    redeemReason: "Redeemed 50% off voucher",
  },
  /** Free drink voucher — earned at 14th consecutive point */
  freeDrinkVoucher: {
    label: "Free drink voucher",
    earnReason: "Earned free drink voucher (14th consecutive point)",
    redeemReason: "Redeemed free drink voucher",
  },
  streakResetReason: "Streak completed — 14 points reset",
  /** localStorage key for persisted data */
  storageKey: "loyalty-points-tracker-data-v2",
  /** Customer QR code payload prefix */
  qr: {
    prefix: "coffeesentials://customer/",
  },
} as const;

export function calculatePointsFromDrinks(drinkCount: number): number {
  return Math.floor(drinkCount * loyaltyConfig.pointsPerDrink);
}

export interface StreakEarnResult {
  consecutivePointsEarned: number;
  vouchersEarned: number;
  freeDrinkVouchersEarned: number;
  pointsReset: number;
  cyclesCompleted: number;
}

/** Walk earned points through the 14-point streak cycle. */
export function applyStreakPointsEarned(
  previousConsecutive: number,
  pointsEarned: number
): StreakEarnResult {
  const { cycleLength, halfOffAt } = loyaltyConfig.streak;

  let consecutive = previousConsecutive;
  let vouchersEarned = 0;
  let freeDrinkVouchersEarned = 0;
  let pointsReset = 0;
  let cyclesCompleted = 0;

  for (let i = 0; i < pointsEarned; i++) {
    consecutive += 1;
    if (consecutive === halfOffAt) {
      vouchersEarned += 1;
    } else if (consecutive === cycleLength) {
      freeDrinkVouchersEarned += 1;
      pointsReset += cycleLength;
      cyclesCompleted += 1;
      consecutive = 0;
    }
  }

  return {
    consecutivePointsEarned: consecutive,
    vouchersEarned,
    freeDrinkVouchersEarned,
    pointsReset,
    cyclesCompleted,
  };
}

export function formatDrinkCount(count: number): string {
  return count === 1
    ? `1 ${loyaltyConfig.drinkLabel}`
    : `${count} ${loyaltyConfig.drinkLabelPlural}`;
}

export function formatStreakProgress(consecutive: number): string {
  const { cycleLength, halfOffAt } = loyaltyConfig.streak;
  if (consecutive >= halfOffAt) {
    return `${consecutive} / ${cycleLength} toward free drink voucher`;
  }
  return `${consecutive} / ${halfOffAt} toward 50% off voucher`;
}
