import { loyaltyConfig } from "@/config/loyalty";
import type { Product, PurchaseItemInput } from "@/types";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(loyaltyConfig.currency.locale, {
    style: "currency",
    currency: loyaltyConfig.currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function productQualifiesForPoints(product: Product): boolean {
  return (
    product.category === "drink" &&
    product.price >= loyaltyConfig.minDrinkPriceForPoints
  );
}

export function calculateProductPointsEarned(
  product: Product,
  quantity: number
): number {
  if (!productQualifiesForPoints(product)) return 0;
  return quantity * loyaltyConfig.pointsPerDrink;
}

export function calculatePurchaseTotals(
  items: PurchaseItemInput[],
  products: Product[]
) {
  let subtotal = 0;
  let pointsEarned = 0;
  const lines: string[] = [];

  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) continue;

    subtotal += product.price * item.quantity;
    pointsEarned += calculateProductPointsEarned(product, item.quantity);
    lines.push(`${item.quantity} × ${product.name}`);
  }

  return {
    subtotal,
    pointsEarned,
    summary: lines.join(", "),
  };
}

export function minDrinkPriceForPointsLabel(): string {
  return formatCurrency(loyaltyConfig.minDrinkPriceForPoints);
}
