import { ESPRESSO_PRODUCT_ID } from "@/lib/data/drink-temperature";
import type { Product } from "@/types";

export function resolveProductIcedPrice(
  product: Pick<Product, "id" | "category" | "price">
): number | null {
  if (product.id === ESPRESSO_PRODUCT_ID) return null;
  if (product.category === "drink") return product.price;
  return null;
}
