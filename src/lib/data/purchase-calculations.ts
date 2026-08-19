import { formatPurchaseLine } from "@/lib/data/drink-temperature";
import { isDrinkCategory } from "@/lib/data/product-categories";
import { getQuarterPounderOptionSurcharge } from "@/lib/data/quarter-pounder-options";
import { loyaltyConfig } from "@/config/loyalty";
import type {
  DrinkTemperature,
  Product,
  PurchaseItemInput,
  QuarterPounderOption,
  VoucherApplyOption,
} from "@/types";

export type { VoucherApplyOption };

export interface CheckoutTotal {
  subtotal: number;
  discount: number;
  discountLabel: string | null;
  total: number;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat(loyaltyConfig.currency.locale, {
    style: "currency",
    currency: loyaltyConfig.currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Remove peso amounts from text shown to customers (e.g. transaction reasons). */
export function stripCurrencyAmounts(text: string): string {
  return text
    .replace(/\s*\(₱[\d,]+(?:\.\d+)?\)/g, "")
    .replace(/₱[\d,]+(?:\.\d+)?\+?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function getUnitPrice(
  product: Product,
  temperature?: DrinkTemperature,
  quarterPounderOption?: QuarterPounderOption
): number {
  let price = product.price;
  if (isDrinkCategory(product.category) && temperature === "iced") {
    price = product.icedPrice ?? product.price;
  }
  price += getQuarterPounderOptionSurcharge(quarterPounderOption);
  return price;
}

export function productQualifiesForPoints(
  product: Product,
  temperature?: DrinkTemperature
): boolean {
  return (
    isDrinkCategory(product.category) &&
    getUnitPrice(product, temperature) >= loyaltyConfig.minDrinkPriceForPoints
  );
}

export function calculateProductPointsEarned(
  product: Product,
  quantity: number,
  temperature?: DrinkTemperature
): number {
  if (!productQualifiesForPoints(product, temperature)) return 0;
  return quantity * loyaltyConfig.pointsPerDrink;
}

function complimentaryDrinkPoints(
  items: PurchaseItemInput[],
  products: Product[]
): number {
  let cheapestPrice = Number.POSITIVE_INFINITY;
  let cheapestPoints = 0;

  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product || !isDrinkCategory(product.category)) continue;

    const price = getUnitPrice(product, item.temperature);
    if (price >= cheapestPrice) continue;

    cheapestPrice = price;
    cheapestPoints = calculateProductPointsEarned(
      product,
      1,
      item.temperature
    );
  }

  return Number.isFinite(cheapestPrice) ? cheapestPoints : 0;
}

export function calculatePurchaseTotals(
  items: PurchaseItemInput[],
  products: Product[],
  voucherToApply: VoucherApplyOption = "none"
) {
  let subtotal = 0;
  let pointsEarned = 0;
  const lines: string[] = [];

  for (const item of items) {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) continue;

    const unitPrice = getUnitPrice(
      product,
      item.temperature,
      item.quarterPounderOption
    );
    subtotal += unitPrice * item.quantity;
    pointsEarned += calculateProductPointsEarned(
      product,
      item.quantity,
      item.temperature
    );
    lines.push(
      formatPurchaseLine(
        product.name,
        item.quantity,
        item.temperature,
        item.quarterPounderOption
      )
    );
  }

  if (voucherToApply === "free-drink-voucher") {
    pointsEarned = Math.max(
      0,
      pointsEarned - complimentaryDrinkPoints(items, products)
    );
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

function drinkUnitPrices(
  cartProducts: {
    product: Product;
    quantity: number;
    temperature?: DrinkTemperature;
    quarterPounderOption?: QuarterPounderOption;
  }[]
): number[] {
  return cartProducts
    .filter(({ product }) => isDrinkCategory(product.category))
    .flatMap(({ product, quantity, temperature }) =>
      Array.from({ length: quantity }, () =>
        getUnitPrice(product, temperature)
      )
    );
}

export function calculateCheckoutTotal(
  subtotal: number,
  cartProducts: {
    product: Product;
    quantity: number;
    temperature?: DrinkTemperature;
    quarterPounderOption?: QuarterPounderOption;
  }[],
  voucherToApply: VoucherApplyOption
): CheckoutTotal {
  let discount = 0;
  let discountLabel: string | null = null;
  const drinkPrices = drinkUnitPrices(cartProducts);

  if (voucherToApply === "voucher" && drinkPrices.length > 0) {
    discount = Math.round(Math.max(...drinkPrices) * 0.5);
    discountLabel = `${loyaltyConfig.voucher.label} (1 drink)`;
  } else if (voucherToApply === "free-drink-voucher" && drinkPrices.length > 0) {
    discount = Math.min(...drinkPrices);
    discountLabel = loyaltyConfig.freeDrinkVoucher.label;
  }

  return {
    subtotal,
    discount,
    discountLabel,
    total: Math.max(0, subtotal - discount),
  };
}
