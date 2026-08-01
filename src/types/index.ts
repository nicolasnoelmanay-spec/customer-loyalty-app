export type TransactionType =
  | "earn"
  | "redeem"
  | "voucher_earn"
  | "voucher_redeem"
  | "free_drink_voucher_earn"
  | "free_drink_voucher_redeem"
  | "adjust";

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  /** Cumulative points earned from coffee purchases (never reduced by redemptions) */
  totalPointsEarned: number;
  consecutivePointsEarned: number;
  /** Unused vouchers (stack across cycles until redeemed) */
  vouchersAvailable: number;
  freeDrinkVouchersAvailable: number;
  /** Lifetime vouchers earned from streak milestones */
  totalVouchersEarned: number;
  totalFreeDrinkVouchersEarned: number;
  createdAt: string;
}

export interface Transaction {
  id: string;
  customerId: string;
  type: TransactionType;
  points: number;
  reason: string;
  createdAt: string;
}

export interface LoyaltyData {
  customers: Customer[];
  transactions: Transaction[];
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  email: string;
}

export interface UpdateCustomerInput {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  points: number;
}

export interface LogPurchaseInput {
  customerId: string;
  drinkCount?: number;
  items?: PurchaseItemInput[];
  notes?: string;
}

export type ProductCategory = "drink" | "snack";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  pointsEarned: number;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
}

export interface RedeemPointsInput {
  customerId: string;
  points: number;
  reason?: string;
}

export interface RedeemVoucherInput {
  customerId: string;
  count?: number;
  reason?: string;
}

export interface RedeemFreeDrinkVoucherInput {
  customerId: string;
  count?: number;
  reason?: string;
}
