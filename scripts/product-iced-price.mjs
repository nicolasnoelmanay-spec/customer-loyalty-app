const ESPRESSO_PRODUCT_ID = "prod-espresso";

export function resolveIcedPrice(product) {
  if (product.iced_price !== undefined) return product.iced_price;
  if (product.id === ESPRESSO_PRODUCT_ID) return null;
  if (product.category === "drink") return product.price;
  return null;
}

export function withIcedPrices(products) {
  return products.map((product) => ({
    ...product,
    iced_price: resolveIcedPrice(product),
  }));
}
