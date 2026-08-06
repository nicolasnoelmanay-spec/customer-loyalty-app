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
  username: string;
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
  username: string;
  password: string;
}

export interface UpdateCustomerInput {
  customerId: string;
  name: string;
  phone: string;
  email: string;
  points: number;
}

export interface UpdateCustomerProfileInput {
  customerId: string;
  name: string;
  phone: string;
  email: string;
}

export interface LogPurchaseInput {
  customerId: string;
  drinkCount?: number;
  items?: PurchaseItemInput[];
  notes?: string;
}

export type ProductCategory = "drink" | "frappe" | "snack";

export type DrinkTemperature = "hot" | "iced";

export type QuarterPounderOption = "cheese" | "tlc";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  /** Iced drink price; null for hot-only drinks, frappés, and snacks */
  icedPrice: number | null;
  pointsEarned: number;
  description: string;
  active: boolean;
  sortOrder: number;
}

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  temperature?: DrinkTemperature;
  quarterPounderOption?: QuarterPounderOption;
}

export type VoucherApplyOption = "none" | "voucher" | "free-drink-voucher";

export type PaymentType = "cash" | "gcash";

export interface PendingOrder {
  id: string;
  customerId: string;
  customerName: string;
  items: PurchaseItemInput[];
  notes: string;
  voucherToApply: VoucherApplyOption;
  paymentType: PaymentType;
  subtotal: number;
  discount: number;
  total: number;
  pointsEarned: number;
  createdAt: string;
}

export interface CompletedOrder extends PendingOrder {
  transactionId: string | null;
  completedAt: string;
}

export interface CreatePendingOrderInput {
  customerId: string;
  items: PurchaseItemInput[];
  notes?: string;
  voucherToApply?: VoucherApplyOption;
  paymentType?: PaymentType;
}

export interface UpdatePendingOrderInput {
  items: PurchaseItemInput[];
  notes?: string;
  voucherToApply?: VoucherApplyOption;
  paymentType?: PaymentType;
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
