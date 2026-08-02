import type { Product, PurchaseItemInput, QuarterPounderOption } from "@/types";

export const QUARTER_POUNDER_PRODUCT_ID = "prod-quarter-pounder";

export const QUARTER_POUNDER_CHEESE_SURCHARGE = 30;
export const QUARTER_POUNDER_TLC_SURCHARGE = 40;

export function productOffersQuarterPounderOptions(product: Product): boolean {
  return product.id === QUARTER_POUNDER_PRODUCT_ID;
}

export function isValidQuarterPounderOption(
  value: unknown
): value is QuarterPounderOption {
  return value === "cheese" || value === "tlc";
}

export function getQuarterPounderOptionSurcharge(
  option?: QuarterPounderOption
): number {
  if (option === "cheese") return QUARTER_POUNDER_CHEESE_SURCHARGE;
  if (option === "tlc") return QUARTER_POUNDER_TLC_SURCHARGE;
  return 0;
}

export function formatQuarterPounderOptionLabel(
  option: QuarterPounderOption
): string {
  return option === "cheese" ? "With Cheese" : "With TLC";
}

export function resolveQuarterPounderOption(
  product: Product,
  option?: QuarterPounderOption
): QuarterPounderOption | undefined {
  if (!productOffersQuarterPounderOptions(product)) return undefined;
  return option;
}

export function normalizePurchaseItemQuarterPounderOption(
  item: PurchaseItemInput,
  product: Product
): PurchaseItemInput {
  const quarterPounderOption = resolveQuarterPounderOption(
    product,
    item.quarterPounderOption
  );
  return quarterPounderOption ? { ...item, quarterPounderOption } : item;
}

export function validatePurchaseItemQuarterPounderOption(
  item: PurchaseItemInput,
  product: Product
): void {
  if (!productOffersQuarterPounderOptions(product)) {
    if (item.quarterPounderOption) {
      throw new Error(`${product.name} does not support add-ons.`);
    }
    return;
  }

  if (
    item.quarterPounderOption !== undefined &&
    !isValidQuarterPounderOption(item.quarterPounderOption)
  ) {
    throw new Error(`Invalid add-on for ${product.name}.`);
  }
}
