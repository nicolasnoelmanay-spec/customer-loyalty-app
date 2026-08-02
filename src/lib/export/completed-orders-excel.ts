import * as XLSX from "xlsx";
import { loyaltyConfig } from "@/config/loyalty";
import { formatQuarterPounderOptionLabel } from "@/lib/data/quarter-pounder-options";
import { formatCurrency, getUnitPrice } from "@/lib/data/purchase-calculations";
import { formatTransactionDate } from "@/lib/format-date";
import type { CompletedOrder, Product, VoucherApplyOption } from "@/types";

function voucherLabel(voucherToApply: VoucherApplyOption): string {
  if (voucherToApply === "voucher") return loyaltyConfig.voucher.label;
  if (voucherToApply === "free-drink-voucher") {
    return loyaltyConfig.freeDrinkVoucher.label;
  }
  return "";
}

function formatOrderItems(
  order: CompletedOrder,
  products: Product[]
): string {
  return order.items
    .map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      const name = product?.name ?? "Item";
      const parts = [`${item.quantity}× ${name}`];
      if (item.temperature) parts.push(item.temperature);
      if (item.quarterPounderOption) {
        parts.push(formatQuarterPounderOptionLabel(item.quarterPounderOption));
      }
      if (product) {
        const unitPrice = getUnitPrice(
          product,
          item.temperature,
          item.quarterPounderOption
        );
        const lineTotal = unitPrice * item.quantity;
        parts.push(
          `@ ${formatCurrency(unitPrice)} = ${formatCurrency(lineTotal)}`
        );
      }
      return parts.join(" · ");
    })
    .join("; ");
}

function buildLineItemRows(orders: CompletedOrder[], products: Product[]) {
  return orders.flatMap((order) =>
    order.items.map((item) => {
      const product = products.find((entry) => entry.id === item.productId);
      const unitPrice = product
        ? getUnitPrice(product, item.temperature, item.quarterPounderOption)
        : null;

      return {
        "Order ID": order.id,
        Customer: order.customerName,
        "Completed At": formatTransactionDate(order.completedAt),
        Product: product?.name ?? "Item",
        Quantity: item.quantity,
        "Unit Price (PHP)": unitPrice,
        "Line Total (PHP)": unitPrice !== null ? unitPrice * item.quantity : null,
        Temperature: item.temperature ?? "",
        Option: item.quarterPounderOption
          ? formatQuarterPounderOptionLabel(item.quarterPounderOption)
          : "",
      };
    })
  );
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-");
}

export function exportCompletedOrdersToExcel(input: {
  orders: CompletedOrder[];
  products: Product[];
  periodLabel: string;
  periodRangeLabel: string;
  stats: {
    orderCount: number;
    customerCount: number;
    totalRevenue: number;
    totalDiscount: number;
    totalPoints: number;
    itemsSold: number;
    voucherOrders: number;
    averageOrder: number;
  };
}): void {
  const { orders, products, periodLabel, periodRangeLabel, stats } = input;

  const orderRows = orders.map((order) => ({
    "Order ID": order.id,
    Customer: order.customerName,
    "Completed At": formatTransactionDate(order.completedAt),
    Items: formatOrderItems(order, products),
    Subtotal: order.subtotal,
    Discount: order.discount,
    Total: order.total,
    "Points Earned": order.pointsEarned,
    "Voucher Applied": voucherLabel(order.voucherToApply),
    Notes: order.notes,
  }));

  const summaryRows = [
    { Metric: "Period", Value: periodLabel },
    { Metric: "Range", Value: periodRangeLabel },
    { Metric: "Total Orders", Value: stats.orderCount },
    { Metric: "Unique Customers", Value: stats.customerCount },
    { Metric: "Items Sold", Value: stats.itemsSold },
    { Metric: "Total Revenue (PHP)", Value: stats.totalRevenue },
    { Metric: "Average Order (PHP)", Value: stats.averageOrder },
    { Metric: "Voucher Savings (PHP)", Value: stats.totalDiscount },
    { Metric: "Orders With Voucher", Value: stats.voucherOrders },
    { Metric: "Points Awarded", Value: stats.totalPoints },
  ];

  const lineItemRows = buildLineItemRows(orders, products);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(summaryRows),
    "Summary"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      orderRows.length > 0
        ? orderRows
        : [{ Message: "No completed orders for this period." }]
    ),
    "Orders"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(
      lineItemRows.length > 0
        ? lineItemRows
        : [{ Message: "No line items for this period." }]
    ),
    "Line Items"
  );

  const filename = sanitizeFilename(
    `completed-orders-${periodLabel}-${periodRangeLabel}.xlsx`
  );
  XLSX.writeFile(workbook, filename);
}
