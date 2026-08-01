"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Coffee,
  Cookie,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
  Ticket,
} from "lucide-react";
import { applyStreakPointsEarned, loyaltyConfig } from "@/config/loyalty";
import { CustomerSelectField } from "@/components/dashboard/customer-select-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateCheckoutTotal,
  calculatePurchaseTotals,
  formatCurrency,
  getUnitPrice,
  icedDrinkSurchargeLabel,
  minDrinkPriceForPointsLabel,
  productQualifiesForPoints,
  type VoucherApplyOption,
} from "@/lib/data/purchase-calculations";
import {
  decodeCartKey,
  encodeCartKey,
  formatTemperatureLabel,
  productOffersHotCold,
  resolveItemTemperature,
} from "@/lib/data/drink-temperature";
import { apiCreatePendingOrder, fetchProducts } from "@/lib/api/loyalty-client";
import { useLoyalty } from "@/hooks/use-loyalty";
import { cn } from "@/lib/utils";
import type { DrinkTemperature, Product, ProductCategory, PurchaseItemInput } from "@/types";

type Cart = Record<string, number>;

function categoryIcon(category: ProductCategory) {
  return category === "drink" ? Coffee : Cookie;
}

export function ProductsContent() {
  const { customers } = useLoyalty();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherToApply, setVoucherToApply] = useState<VoucherApplyOption>("none");
  const [drinkTemperature, setDrinkTemperature] = useState<
    Record<string, DrinkTemperature>
  >({});

  useEffect(() => {
    let cancelled = false;
    fetchProducts()
      .then((loaded) => {
        if (!cancelled) setProducts(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load products.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const cartItems: PurchaseItemInput[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([key, quantity]) => {
          const { productId, temperature } = decodeCartKey(key);
          return temperature
            ? { productId, quantity, temperature }
            : { productId, quantity };
        }),
    [cart]
  );

  const cartProducts = useMemo(
    () =>
      cartItems.flatMap((item) => {
        const product = products.find((entry) => entry.id === item.productId);
        if (!product) return [];
        return [
          {
            product,
            quantity: item.quantity,
            temperature: item.temperature,
          },
        ];
      }),
    [cartItems, products]
  );

  const totals = useMemo(
    () => calculatePurchaseTotals(cartItems, products),
    [cartItems, products]
  );

  const checkoutTotal = useMemo(
    () => calculateCheckoutTotal(totals.subtotal, cartProducts, voucherToApply),
    [totals.subtotal, cartProducts, voucherToApply]
  );

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const hasFiftyOffVoucher = (selectedCustomer?.vouchersAvailable ?? 0) > 0;
  const hasFreeDrinkVoucher =
    (selectedCustomer?.freeDrinkVouchersAvailable ?? 0) > 0;
  const streakPreview =
    selectedCustomer && totals.pointsEarned > 0
      ? applyStreakPointsEarned(
          selectedCustomer.consecutivePointsEarned,
          totals.pointsEarned
        )
      : null;

  const getSelectedTemperature = useCallback(
    (product: Product): DrinkTemperature => {
      if (productOffersHotCold(product)) {
        return drinkTemperature[product.id] ?? "hot";
      }
      return "iced";
    },
    [drinkTemperature]
  );

  const cartKeyForProduct = useCallback(
    (product: Product) => {
      const temperature = resolveItemTemperature(
        product,
        getSelectedTemperature(product)
      );
      return encodeCartKey(product.id, temperature);
    },
    [getSelectedTemperature]
  );

  const updateQuantity = useCallback((cartKey: string, delta: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[cartKey] ?? 0) + delta);
      if (nextQuantity === 0) {
        const { [cartKey]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [cartKey]: nextQuantity };
    });
  }, []);

  function resetCheckout() {
    setCart({});
    setNotes("");
    setError(null);
    setVoucherToApply("none");
  }

  function handleCustomerChange(nextCustomerId: string) {
    setCustomerId(nextCustomerId);
    setVoucherToApply("none");
  }

  async function handleAddToPendingOrder(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!customerId) {
      setError("Select a customer before adding to pending orders.");
      return;
    }
    if (cartItems.length === 0) {
      setError("Add at least one product to the cart.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiCreatePendingOrder({
        customerId,
        items: cartItems,
        notes: notes.trim() || undefined,
        voucherToApply,
      });

      resetCheckout();
      setSuccess("Added to pending orders.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add pending order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderProductGrid(category: ProductCategory | "all") {
    const filtered =
      category === "all"
        ? products
        : products.filter((product) => product.category === category);

    if (isLoading) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Loading products…
        </p>
      );
    }

    if (filtered.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No products available.
        </p>
      );
    }

    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((product) => {
          const Icon = categoryIcon(product.category);
          const cartKey = cartKeyForProduct(product);
          const quantity = cart[cartKey] ?? 0;
          const selectedTemp = getSelectedTemperature(product);
          const unitPrice = getUnitPrice(product, selectedTemp);

          return (
            <Card key={product.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </div>
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Icon className="size-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{formatCurrency(unitPrice)}</Badge>
                  {productQualifiesForPoints(product, selectedTemp) ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      +{loyaltyConfig.pointsPerDrink} pt
                    </Badge>
                  ) : product.category === "drink" ? (
                    <Badge variant="secondary">
                      Under {minDrinkPriceForPointsLabel()} ({formatTemperatureLabel(selectedTemp)})
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No points</Badge>
                  )}
                </div>
                {product.category === "drink" && (
                  <div className="space-y-2">
                    {productOffersHotCold(product) ? (
                      <>
                        <Label className="text-xs text-muted-foreground">
                          Temperature
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["hot", "iced"] as const).map((temp) => (
                            <button
                              key={temp}
                              type="button"
                              onClick={() =>
                                setDrinkTemperature((current) => ({
                                  ...current,
                                  [product.id]: temp,
                                }))
                              }
                              className={cn(
                                "rounded-md border px-2 py-1.5 text-xs font-medium transition-colors",
                                selectedTemp === temp
                                  ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                                  : "border-border hover:bg-muted/50"
                              )}
                            >
                              {formatTemperatureLabel(temp)}
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Iced adds {icedDrinkSurchargeLabel()}
                        </p>
                      </>
                    ) : (
                      <Badge variant="secondary">Iced only</Badge>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Decrease ${product.name}`}
                      onClick={() => updateQuantity(cartKey, -1)}
                      disabled={quantity === 0}
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Increase ${product.name}`}
                      onClick={() => updateQuantity(cartKey, 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={quantity > 0 ? "secondary" : "default"}
                    className={quantity === 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : undefined}
                    onClick={() => updateQuantity(cartKey, 1)}
                  >
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Build an order of drinks and snacks for {loyaltyConfig.programName}.
          </p>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="drink">Drinks</TabsTrigger>
            <TabsTrigger value="snack">Snacks</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {renderProductGrid("all")}
          </TabsContent>
          <TabsContent value="drink" className="mt-4">
            {renderProductGrid("drink")}
          </TabsContent>
          <TabsContent value="snack" className="mt-4">
            {renderProductGrid("snack")}
          </TabsContent>
        </Tabs>
      </div>

      <Card className="h-fit xl:sticky xl:top-20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingBag className="size-5 text-emerald-600" />
            Checkout
          </CardTitle>
          <CardDescription>
            Drinks are available hot or iced (+{icedDrinkSurchargeLabel()} for iced),
            except Cold Brew. Drinks priced at {minDrinkPriceForPointsLabel()} or more
            earn {loyaltyConfig.pointsPerDrink} loyalty point each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddToPendingOrder} className="space-y-4">
            <CustomerSelectField
              customerId={customerId}
              customers={customers}
              onCustomerIdChange={handleCustomerChange}
              onScanError={setError}
            />

            {selectedCustomer && (
              <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-2">
                <p className="font-medium">Available vouchers</p>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      hasFiftyOffVoucher
                        ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                        : undefined
                    }
                  >
                    <Ticket className="mr-1 size-3" />
                    {selectedCustomer.vouchersAvailable} ×{" "}
                    {loyaltyConfig.voucher.label}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={
                      hasFreeDrinkVoucher
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        : undefined
                    }
                  >
                    <Coffee className="mr-1 size-3" />
                    {selectedCustomer.freeDrinkVouchersAvailable} ×{" "}
                    {loyaltyConfig.freeDrinkVoucher.label}
                  </Badge>
                </div>
                {(hasFiftyOffVoucher || hasFreeDrinkVoucher) && (
                  <div className="space-y-2 pt-1">
                    <Label>Apply voucher to this order</Label>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={() => setVoucherToApply("none")}
                        className={cn(
                          "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          voucherToApply === "none"
                            ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        No voucher
                      </button>
                      {hasFiftyOffVoucher && (
                        <button
                          type="button"
                          onClick={() => setVoucherToApply("voucher")}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            voucherToApply === "voucher"
                              ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <span className="font-medium">
                            {loyaltyConfig.voucher.label}
                          </span>
                          <span className="block text-muted-foreground">
                            50% off one drink · uses 1 from stack
                          </span>
                        </button>
                      )}
                      {hasFreeDrinkVoucher && (
                        <button
                          type="button"
                          onClick={() => setVoucherToApply("free-drink-voucher")}
                          className={cn(
                            "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                            voucherToApply === "free-drink-voucher"
                              ? "border-amber-600 bg-amber-50 dark:bg-amber-950/40"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          <span className="font-medium">
                            {loyaltyConfig.freeDrinkVoucher.label}
                          </span>
                          <span className="block text-muted-foreground">
                            Uses 1 from stack · does not affect points
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Order</Label>
              {cartProducts.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Your cart is empty.
                </p>
              ) : (
                <div className="space-y-2">
                  {cartProducts.map(({ product, quantity, temperature }) => {
                    const unitPrice = getUnitPrice(product, temperature);
                    return (
                    <div
                      key={`${product.id}:${temperature ?? "snack"}`}
                      className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {product.name}
                          {temperature
                            ? ` · ${formatTemperatureLabel(temperature)}`
                            : ""}
                        </p>
                        <p className="text-muted-foreground">
                          {quantity} × {formatCurrency(unitPrice)}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(unitPrice * quantity)}
                      </p>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(checkoutTotal.subtotal)}
                </span>
              </div>
              {checkoutTotal.discount > 0 && checkoutTotal.discountLabel && (
                <div className="flex justify-between text-indigo-700 dark:text-indigo-300">
                  <span>{checkoutTotal.discountLabel}</span>
                  <span className="font-medium">
                    −{formatCurrency(checkoutTotal.discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between border-t pt-2">
                <span className="font-semibold">Total</span>
                <span className="text-base font-semibold">
                  {formatCurrency(checkoutTotal.total)}
                </span>
              </div>
              {(voucherToApply === "voucher" ||
                voucherToApply === "free-drink-voucher") &&
                checkoutTotal.discount === 0 &&
                cartProducts.length > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Add a drink to apply the selected voucher discount.
                  </p>
                )}
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">Points to award</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  +{totals.pointsEarned}
                </span>
              </div>
            </div>

            {selectedCustomer && totals.pointsEarned > 0 && streakPreview && (
              <div className="rounded-lg border bg-emerald-50/80 px-3 py-3 text-sm dark:bg-emerald-950/20 space-y-1">
                <p className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="size-4" />
                  Loyalty preview
                </p>
                {streakPreview.vouchersEarned > 0 && (
                  <p>+{streakPreview.vouchersEarned} voucher(s)</p>
                )}
                {streakPreview.freeDrinkVouchersEarned > 0 && (
                  <p>+{streakPreview.freeDrinkVouchersEarned} free drink voucher(s)</p>
                )}
                <p className="text-muted-foreground">
                  Balance after:{" "}
                  {Math.max(
                    0,
                    selectedCustomer.points +
                      totals.pointsEarned -
                      streakPreview.pointsReset
                  )}{" "}
                  pts
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="order-notes">Notes (optional)</Label>
              <Textarea
                id="order-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Takeaway, oat milk"
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {success}{" "}
                <Link href="/pending-orders" className="font-medium underline underline-offset-2">
                  View pending orders
                </Link>
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isSubmitting || cartProducts.length === 0}
            >
              {isSubmitting
                ? "Adding..."
                : cartProducts.length > 0
                  ? `Add to Pending Order · ${formatCurrency(checkoutTotal.total)}`
                  : "Add to Pending Order"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
