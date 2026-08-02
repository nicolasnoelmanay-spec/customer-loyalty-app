import {
  ESPRESSO_PRODUCT_ID,
  PISTACHIO_LATTE_PRODUCT_ID,
} from "@/lib/data/drink-temperature";
import type { Product } from "@/types";

/** Explicit iced prices for hot/cold drinks (hot price is stored on `price`). */
export const DRINK_ICED_PRICES: Record<string, number> = {
  "prod-americano": 100,
  "prod-caramel-macchiato": 130,
  "prod-latte": 120,
  "prod-cappuccino": 135,
  "prod-mocha": 130,
  "prod-peppermint-mocha": 145,
  "prod-spanish-latte": 145,
  "prod-matcha-espresso": 165,
  "prod-white-chocolate-mocha": 130,
  "prod-salted-caramel": 145,
  "prod-matcha": 155,
  [PISTACHIO_LATTE_PRODUCT_ID]: 145,
};

export function resolveProductIcedPrice(
  product: Pick<Product, "id" | "category" | "price">
): number | null {
  if (product.id === ESPRESSO_PRODUCT_ID) return null;

  const explicit = DRINK_ICED_PRICES[product.id];
  if (explicit !== undefined) return explicit;

  if (product.category === "drink") return product.price;

  return null;
}
