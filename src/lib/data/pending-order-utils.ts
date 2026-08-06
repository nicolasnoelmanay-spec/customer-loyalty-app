import {
  calculateCheckoutTotal,
  calculatePurchaseTotals,
} from "@/lib/data/purchase-calculations";
import { isNonMemberCustomer } from "@/lib/data/non-member";
import type {
  CompletedOrder,
  PaymentType,
  PendingOrder,
  Product,
  PurchaseItemInput,
  VoucherApplyOption,
} from "@/types";

export interface PendingOrderRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  notes: string;
  voucher_to_apply: string;
  payment_type: string;
  items: PurchaseItemInput[];
  created_at: Date | string;
}

function cartProductsFromItems(items: PurchaseItemInput[], products: Product[]) {
  return items.flatMap((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) return [];
    return [
      {
        product,
        quantity: item.quantity,
        temperature: item.temperature,
        quarterPounderOption: item.quarterPounderOption,
      },
    ];
  });
}

export interface CompletedOrderRecord extends PendingOrderRecord {
  transaction_id: string | null;
  subtotal: number;
  discount: number;
  total: number;
  points_earned: number;
  completed_at: Date | string;
}

export function normalizePaymentType(value: unknown): PaymentType {
  return value === "gcash" ? "gcash" : "cash";
}

export function formatPaymentTypeLabel(paymentType: PaymentType): string {
  return paymentType === "gcash" ? "GCash" : "Cash";
}

export function enrichCompletedOrder(
  record: CompletedOrderRecord
): CompletedOrder {
  return {
    id: record.id,
    customerId: record.customer_id,
    customerName: record.customer_name,
    items: record.items,
    notes: record.notes,
    voucherToApply: record.voucher_to_apply as VoucherApplyOption,
    paymentType: normalizePaymentType(record.payment_type),
    subtotal: Number(record.subtotal),
    discount: Number(record.discount),
    total: Number(record.total),
    pointsEarned: Number(record.points_earned),
    createdAt: new Date(record.created_at).toISOString(),
    transactionId: record.transaction_id,
    completedAt: new Date(record.completed_at).toISOString(),
  };
}

function purchaseItemKey(item: PurchaseItemInput): string {
  return [
    item.productId,
    item.temperature ?? "",
    item.quarterPounderOption ?? "",
  ].join(":");
}

export function mergePurchaseItems(
  existing: PurchaseItemInput[],
  additions: PurchaseItemInput[]
): PurchaseItemInput[] {
  const merged = new Map<string, PurchaseItemInput>();

  for (const item of [...existing, ...additions]) {
    if (item.quantity <= 0) continue;
    const key = purchaseItemKey(item);
    const current = merged.get(key);
    if (current) {
      merged.set(key, {
        ...current,
        quantity: current.quantity + item.quantity,
      });
      continue;
    }
    merged.set(key, { ...item });
  }

  return Array.from(merged.values());
}

export function enrichPendingOrder(
  record: PendingOrderRecord,
  products: Product[]
): PendingOrder {
  const items = record.items;
  const voucherToApply = isNonMemberCustomer(record.customer_id)
    ? "none"
    : (record.voucher_to_apply as VoucherApplyOption);
  const cartProducts = cartProductsFromItems(items, products);
  const totals = calculatePurchaseTotals(items, products);
  const checkout = calculateCheckoutTotal(
    totals.subtotal,
    cartProducts,
    voucherToApply
  );
  const pointsEarned = isNonMemberCustomer(record.customer_id)
    ? 0
    : totals.pointsEarned;

  return {
    id: record.id,
    customerId: record.customer_id,
    customerName: record.customer_name,
    items,
    notes: record.notes,
    voucherToApply,
    paymentType: normalizePaymentType(record.payment_type),
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    total: checkout.total,
    pointsEarned,
    createdAt: new Date(record.created_at).toISOString(),
  };
}
