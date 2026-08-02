import type { DrinkTemperature, Product, PurchaseItemInput } from "@/types";
import { isHotColdDrinkProduct } from "@/lib/data/product-categories";
import {
  isValidQuarterPounderOption,
} from "@/lib/data/quarter-pounder-options";
import type { QuarterPounderOption } from "@/types";

export const ESPRESSO_PRODUCT_ID = "prod-espresso";
export const PISTACHIO_LATTE_PRODUCT_ID = "prod-pistachio-latte";

const HOT_ONLY_DRINK_IDS = new Set<string>([ESPRESSO_PRODUCT_ID]);
const ICED_ONLY_DRINK_IDS = new Set<string>([PISTACHIO_LATTE_PRODUCT_ID]);

export function productIsHotOnlyDrink(product: Product): boolean {
  return HOT_ONLY_DRINK_IDS.has(product.id);
}

export function productIsIcedOnlyDrink(product: Product): boolean {
  return ICED_ONLY_DRINK_IDS.has(product.id);
}

export function productOffersHotCold(product: Product): boolean {
  return (
    isHotColdDrinkProduct(product) &&
    !productIsHotOnlyDrink(product) &&
    !productIsIcedOnlyDrink(product)
  );
}

export function resolveItemTemperature(
  product: Product,
  temperature?: DrinkTemperature
): DrinkTemperature | undefined {
  if (!isHotColdDrinkProduct(product)) return undefined;
  if (productIsHotOnlyDrink(product)) return "hot";
  if (productIsIcedOnlyDrink(product)) return "iced";
  return temperature;
}

export function isValidDrinkTemperature(
  value: unknown
): value is DrinkTemperature {
  return value === "hot" || value === "iced";
}

export function formatTemperatureLabel(temperature: DrinkTemperature): string {
  return temperature === "hot" ? "Hot" : "Iced";
}

export function encodeCartKey(
  productId: string,
  variant?: DrinkTemperature | QuarterPounderOption
): string {
  return variant ? `${productId}:${variant}` : productId;
}

export function decodeCartKey(key: string): {
  productId: string;
  temperature?: DrinkTemperature;
  quarterPounderOption?: QuarterPounderOption;
} {
  const separator = key.indexOf(":");
  if (separator === -1) return { productId: key };

  const productId = key.slice(0, separator);
  const variant = key.slice(separator + 1);
  if (variant === "cold") {
    return { productId, temperature: "iced" };
  }
  if (isValidDrinkTemperature(variant)) {
    return { productId, temperature: variant };
  }
  if (isValidQuarterPounderOption(variant)) {
    return { productId, quarterPounderOption: variant };
  }
  return { productId: key };
}

export function formatPurchaseLine(
  productName: string,
  quantity: number,
  temperature?: DrinkTemperature,
  quarterPounderOption?: QuarterPounderOption
): string {
  const tempLabel = temperature
    ? ` (${formatTemperatureLabel(temperature)})`
    : "";
  const addOnLabel = quarterPounderOption
    ? ` (${quarterPounderOption === "cheese" ? "With Cheese" : "With TLC"})`
    : "";
  return `${quantity} × ${productName}${tempLabel}${addOnLabel}`;
}

export function normalizePurchaseItem(
  item: PurchaseItemInput,
  product: Product
): PurchaseItemInput {
  const temperature = resolveItemTemperature(product, item.temperature);
  return temperature ? { ...item, temperature } : item;
}

export function validatePurchaseItemTemperature(
  item: PurchaseItemInput,
  product: Product
): void {
  if (!isHotColdDrinkProduct(product)) return;

  if (productIsHotOnlyDrink(product)) {
    if (item.temperature && item.temperature !== "hot") {
      throw new Error(`${product.name} is only available hot.`);
    }
    return;
  }

  if (productIsIcedOnlyDrink(product)) {
    if (item.temperature && item.temperature !== "iced") {
      throw new Error(`${product.name} is only available iced.`);
    }
    return;
  }

  if (!item.temperature || !isValidDrinkTemperature(item.temperature)) {
    throw new Error(`Select hot or iced for ${product.name}.`);
  }
}
