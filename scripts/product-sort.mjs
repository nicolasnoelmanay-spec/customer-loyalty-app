const CATEGORY_ORDER = {
  drink: 0,
  frappe: 1,
  snack: 2,
};

export function sortProductsForCatalog(products) {
  return [...products]
    .sort((a, b) => {
      const categoryDiff =
        (CATEGORY_ORDER[a.category] ?? 99) - (CATEGORY_ORDER[b.category] ?? 99);
      if (categoryDiff !== 0) return categoryDiff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    })
    .map((product, index) => ({ ...product, sort_order: index }));
}
