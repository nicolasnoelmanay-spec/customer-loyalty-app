import type { Product, ProductCategory } from "@/types";

export function isDrinkCategory(category: ProductCategory): boolean {
  return category === "drink" || category === "frappe";
}

export function isFrappeCategory(category: ProductCategory): boolean {
  return category === "frappe";
}

export function isHotColdDrinkProduct(product: Product): boolean {
  return product.category === "drink";
}

export function productCategoryLabel(category: ProductCategory): string {
  switch (category) {
    case "drink":
      return "Drink";
    case "frappe":
      return "Frappé";
    case "snack":
      return "Snack";
  }
}
