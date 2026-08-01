import type { DrinkTemperature, Product, PurchaseItemInput } from "@/types";

export const COLD_BREW_PRODUCT_ID = "prod-cold-brew";

export function productOffersHotCold(product: Product): boolean {
  return product.category === "drink" && product.id !== COLD_BREW_PRODUCT_ID;
}

export function resolveItemTemperature(
  product: Product,
  temperature?: DrinkTemperature
): DrinkTemperature | undefined {
  if (product.category !== "drink") return undefined;
  if (product.id === COLD_BREW_PRODUCT_ID) return "iced";
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
  temperature?: DrinkTemperature
): string {
  return temperature ? `${productId}:${temperature}` : productId;
}

export function decodeCartKey(key: string): {
  productId: string;
  temperature?: DrinkTemperature;
} {
  const separator = key.indexOf(":");
  if (separator === -1) return { productId: key };

  const productId = key.slice(0, separator);
  const temperature = key.slice(separator + 1);
  if (temperature === "cold") {
    return { productId, temperature: "iced" };
  }
  if (isValidDrinkTemperature(temperature)) {
    return { productId, temperature };
  }
  return { productId: key };
}

export function formatPurchaseLine(
  productName: string,
  quantity: number,
  temperature?: DrinkTemperature
): string {
  const tempLabel = temperature
    ? ` (${formatTemperatureLabel(temperature)})`
    : "";
  return `${quantity} × ${productName}${tempLabel}`;
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
  if (product.category !== "drink") return;

  if (product.id === COLD_BREW_PRODUCT_ID) {
    if (item.temperature && item.temperature !== "iced") {
      throw new Error("Cold Brew is only available iced.");
    }
    return;
  }

  if (!item.temperature || !isValidDrinkTemperature(item.temperature)) {
    throw new Error(`Select hot or iced for ${product.name}.`);
  }
}
