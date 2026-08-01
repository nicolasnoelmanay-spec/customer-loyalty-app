"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Coffee,
  Cookie,
  Minus,
  Plus,
  ShoppingBag,
  Sparkles,
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
  calculatePurchaseTotals,
  formatCurrency,
  minDrinkPriceForPointsLabel,
  productQualifiesForPoints,
} from "@/lib/data/purchase-calculations";
import { apiLogPurchase, fetchProducts } from "@/lib/api/loyalty-client";
import { useLoyalty } from "@/hooks/use-loyalty";
import type { Product, ProductCategory, PurchaseItemInput } from "@/types";

type Cart = Record<string, number>;

function categoryIcon(category: ProductCategory) {
  return category === "drink" ? Coffee : Cookie;
}

export function ProductsContent() {
  const { customers, refresh } = useLoyalty();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [customerId, setCustomerId] = useState("");
  const [cart, setCart] = useState<Cart>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        .map(([productId, quantity]) => ({ productId, quantity })),
    [cart]
  );

  const cartProducts = useMemo(
    () =>
      cartItems
        .map((item) => ({
          product: products.find((entry) => entry.id === item.productId),
          quantity: item.quantity,
        }))
        .filter(
          (entry): entry is { product: Product; quantity: number } =>
            Boolean(entry.product)
        ),
    [cartItems, products]
  );

  const totals = useMemo(
    () => calculatePurchaseTotals(cartItems, products),
    [cartItems, products]
  );

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const streakPreview =
    selectedCustomer && totals.pointsEarned > 0
      ? applyStreakPointsEarned(
          selectedCustomer.consecutivePointsEarned,
          totals.pointsEarned
        )
      : null;

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, (current[productId] ?? 0) + delta);
      if (nextQuantity === 0) {
        const { [productId]: _, ...rest } = current;
        return rest;
      }
      return { ...current, [productId]: nextQuantity };
    });
  }, []);

  function resetCheckout() {
    setCart({});
    setNotes("");
    setError(null);
  }

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!customerId) {
      setError("Select a customer before checkout.");
      return;
    }
    if (cartItems.length === 0) {
      setError("Add at least one product to the cart.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiLogPurchase({
        customerId,
        items: cartItems,
        notes: notes.trim() || undefined,
      });
      await refresh();
      resetCheckout();
      setSuccess("Purchase completed and loyalty points updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
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
          const quantity = cart[product.id] ?? 0;

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
                  <Badge variant="secondary">{formatCurrency(product.price)}</Badge>
                  {productQualifiesForPoints(product) ? (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      +{loyaltyConfig.pointsPerDrink} pt
                    </Badge>
                  ) : product.category === "drink" ? (
                    <Badge variant="secondary">Under {minDrinkPriceForPointsLabel()}</Badge>
                  ) : (
                    <Badge variant="secondary">No points</Badge>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Decrease ${product.name}`}
                      onClick={() => updateQuantity(product.id, -1)}
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
                      onClick={() => updateQuantity(product.id, 1)}
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={quantity > 0 ? "secondary" : "default"}
                    className={quantity === 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : undefined}
                    onClick={() => updateQuantity(product.id, 1)}
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
            Drinks priced at {minDrinkPriceForPointsLabel()} or more earn{" "}
            {loyaltyConfig.pointsPerDrink} loyalty point each. Cheaper drinks and
            snacks do not earn points.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCheckout} className="space-y-4">
            <CustomerSelectField
              customerId={customerId}
              customers={customers}
              onCustomerIdChange={setCustomerId}
              onScanError={setError}
            />

            <div className="space-y-2">
              <Label>Order</Label>
              {cartProducts.length === 0 ? (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                  Your cart is empty.
                </p>
              ) : (
                <div className="space-y-2">
                  {cartProducts.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-muted-foreground">
                          {quantity} × {formatCurrency(product.price)}
                        </p>
                      </div>
                      <p className="font-medium">
                        {formatCurrency(product.price * quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between">
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
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isSubmitting || cartProducts.length === 0}
            >
              {isSubmitting ? "Processing..." : "Complete Purchase"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
