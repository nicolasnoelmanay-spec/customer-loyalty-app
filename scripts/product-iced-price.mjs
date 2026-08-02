const ESPRESSO_PRODUCT_ID = "prod-espresso";
const PISTACHIO_LATTE_PRODUCT_ID = "prod-pistachio-latte";

/** Explicit iced prices for hot/cold drinks (hot price is stored on `price`). */
const DRINK_ICED_PRICES = {
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

export function resolveIcedPrice(product) {
  if (product.iced_price !== undefined) return product.iced_price;
  if (product.id === ESPRESSO_PRODUCT_ID) return null;

  const explicit = DRINK_ICED_PRICES[product.id];
  if (explicit !== undefined) return explicit;

  if (product.category === "drink") return product.price;

  return null;
}

export function withIcedPrices(products) {
  return products.map((product) => ({
    ...product,
    iced_price: resolveIcedPrice(product),
  }));
}
