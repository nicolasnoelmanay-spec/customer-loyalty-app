import type { ProductCategory } from "@/types";

const CATEGORY_ORDER: Record<ProductCategory, number> = {
  drink: 0,
  frappe: 1,
  snack: 2,
};

export function compareProductsByCatalogOrder(
  a: { category: ProductCategory | string; name: string },
  b: { category: ProductCategory | string; name: string }
): number {
  const categoryDiff =
    (CATEGORY_ORDER[a.category as ProductCategory] ?? 99) -
    (CATEGORY_ORDER[b.category as ProductCategory] ?? 99);
  if (categoryDiff !== 0) return categoryDiff;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}
