import {
  calculateCheckoutTotal,
  calculatePurchaseTotals,
} from "@/lib/data/purchase-calculations";
import type {
  CompletedOrder,
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
    subtotal: Number(record.subtotal),
    discount: Number(record.discount),
    total: Number(record.total),
    pointsEarned: Number(record.points_earned),
    createdAt: new Date(record.created_at).toISOString(),
    transactionId: record.transaction_id,
    completedAt: new Date(record.completed_at).toISOString(),
  };
}

export function enrichPendingOrder(
  record: PendingOrderRecord,
  products: Product[]
): PendingOrder {
  const items = record.items;
  const voucherToApply = record.voucher_to_apply as VoucherApplyOption;
  const cartProducts = cartProductsFromItems(items, products);
  const totals = calculatePurchaseTotals(items, products);
  const checkout = calculateCheckoutTotal(
    totals.subtotal,
    cartProducts,
    voucherToApply
  );

  return {
    id: record.id,
    customerId: record.customer_id,
    customerName: record.customer_name,
    items,
    notes: record.notes,
    voucherToApply,
    subtotal: checkout.subtotal,
    discount: checkout.discount,
    total: checkout.total,
    pointsEarned: totals.pointsEarned,
    createdAt: new Date(record.created_at).toISOString(),
  };
}
