"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Coffee,
  Cookie,
  CupSoda,
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
  minDrinkPriceForPointsLabel,
  productQualifiesForPoints,
  type VoucherApplyOption,
} from "@/lib/data/purchase-calculations";
import {
  decodeCartKey,
  encodeCartKey,
  formatTemperatureLabel,
  productIsHotOnlyDrink,
  productIsIcedOnlyDrink,
  productOffersHotCold,
  resolveItemTemperature,
} from "@/lib/data/drink-temperature";
import {
  formatQuarterPounderOptionLabel,
  productOffersQuarterPounderOptions,
  QUARTER_POUNDER_CHEESE_SURCHARGE,
  QUARTER_POUNDER_TLC_SURCHARGE,
  resolveQuarterPounderOption,
} from "@/lib/data/quarter-pounder-options";
import { isDrinkCategory } from "@/lib/data/product-categories";
import { mergePurchaseItems } from "@/lib/data/pending-order-utils";
import {
  apiCreatePendingOrder,
  apiUpdatePendingOrder,
  fetchPendingOrders,
  fetchProducts,
} from "@/lib/api/loyalty-client";
import { useLoyalty } from "@/hooks/use-loyalty";
import { cn } from "@/lib/utils";
import {
  NON_MEMBER_CUSTOMER_ID,
  isNonMemberCustomer,
} from "@/lib/data/non-member";
import type {
  DrinkTemperature,
  PendingOrder,
  Product,
  ProductCategory,
  PurchaseItemInput,
  QuarterPounderOption,
} from "@/types";

type Cart = Record<string, number>;

function categoryIcon(category: ProductCategory) {
  if (category === "drink") return Coffee;
  if (category === "frappe") return CupSoda;
  return Cookie;
}

function ProductsContentInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingOrderId = searchParams.get("pendingOrderId");
  const { customers } = useLoyalty();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingOrder, setEditingOrder] = useState<PendingOrder | null>(null);
  const [customerId, setCustomerId] = useState(NON_MEMBER_CUSTOMER_ID);
  const [cart, setCart] = useState<Cart>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherToApply, setVoucherToApply] = useState<VoucherApplyOption>("none");
  const [drinkTemperature, setDrinkTemperature] = useState<
    Record<string, DrinkTemperature>
  >({});
  const [quarterPounderOptions, setQuarterPounderOptions] = useState<
    Record<string, QuarterPounderOption | undefined>
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

  useEffect(() => {
    if (!pendingOrderId) {
      setEditingOrder(null);
      return;
    }

    let cancelled = false;
    fetchPendingOrders()
      .then((orders) => {
        if (cancelled) return;
        const order = orders.find((entry) => entry.id === pendingOrderId);
        if (!order) {
          setEditingOrder(null);
          setError("Pending order not found. It may have been completed or removed.");
          router.replace("/products");
          return;
        }
        setEditingOrder(order);
        setCustomerId(order.customerId);
        setNotes(order.notes);
        setVoucherToApply(order.voucherToApply);
        setCart({});
        setSuccess(null);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Failed to load pending order.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pendingOrderId, router]);

  const cartItems: PurchaseItemInput[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([key, quantity]) => {
          const { productId, temperature, quarterPounderOption } =
            decodeCartKey(key);
          const item: PurchaseItemInput = { productId, quantity };
          if (temperature) item.temperature = temperature;
          if (quarterPounderOption) {
            item.quarterPounderOption = quarterPounderOption;
          }
          return item;
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
            quarterPounderOption: item.quarterPounderOption,
          },
        ];
      }),
    [cartItems, products]
  );

  const totals = useMemo(
    () => calculatePurchaseTotals(cartItems, products),
    [cartItems, products]
  );

  const isEditingPendingOrder = editingOrder !== null;
  const isNonMemberCheckout = isNonMemberCustomer(customerId);
  const effectiveVoucherToApply = isNonMemberCheckout ? "none" : voucherToApply;

  const checkoutTotal = useMemo(
    () =>
      calculateCheckoutTotal(
        totals.subtotal,
        cartProducts,
        effectiveVoucherToApply
      ),
    [totals.subtotal, cartProducts, effectiveVoucherToApply]
  );

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const hasFiftyOffVoucher =
    !isNonMemberCheckout && (selectedCustomer?.vouchersAvailable ?? 0) > 0;
  const hasFreeDrinkVoucher =
    !isNonMemberCheckout &&
    (selectedCustomer?.freeDrinkVouchersAvailable ?? 0) > 0;
  const displayPointsEarned = isNonMemberCheckout ? 0 : totals.pointsEarned;
  const streakPreview =
    selectedCustomer && !isNonMemberCheckout && totals.pointsEarned > 0
      ? applyStreakPointsEarned(
          selectedCustomer.consecutivePointsEarned,
          totals.pointsEarned
        )
      : null;

  const getSelectedTemperature = useCallback(
    (product: Product): DrinkTemperature => {
      if (productIsHotOnlyDrink(product)) return "hot";
      if (productIsIcedOnlyDrink(product)) return "iced";
      if (productOffersHotCold(product)) {
        return drinkTemperature[product.id] ?? "hot";
      }
      return "hot";
    },
    [drinkTemperature]
  );

  const getSelectedQuarterPounderOption = useCallback(
    (product: Product): QuarterPounderOption | undefined => {
      if (!productOffersQuarterPounderOptions(product)) return undefined;
      return quarterPounderOptions[product.id];
    },
    [quarterPounderOptions]
  );

  const setProductTemperature = useCallback(
    (product: Product, temp: DrinkTemperature) => {
      const oldKey = encodeCartKey(
        product.id,
        resolveItemTemperature(product, getSelectedTemperature(product))
      );
      const newKey = encodeCartKey(product.id, temp);

      setDrinkTemperature((current) => ({ ...current, [product.id]: temp }));

      if (oldKey === newKey) return;

      setCart((current) => {
        const quantity = current[oldKey] ?? 0;
        if (quantity === 0) return current;
        const { [oldKey]: _, ...rest } = current;
        return { ...rest, [newKey]: (rest[newKey] ?? 0) + quantity };
      });
    },
    [getSelectedTemperature]
  );

  const setProductQuarterPounderOption = useCallback(
    (product: Product, option: QuarterPounderOption | undefined) => {
      const oldKey = encodeCartKey(
        product.id,
        resolveQuarterPounderOption(
          product,
          getSelectedQuarterPounderOption(product)
        )
      );
      const newKey = encodeCartKey(product.id, option);

      setQuarterPounderOptions((current) => ({ ...current, [product.id]: option }));

      if (oldKey === newKey) return;

      setCart((current) => {
        const quantity = current[oldKey] ?? 0;
        if (quantity === 0) return current;
        const { [oldKey]: _, ...rest } = current;
        return { ...rest, [newKey]: (rest[newKey] ?? 0) + quantity };
      });
    },
    [getSelectedQuarterPounderOption]
  );

  const cartKeyForProduct = useCallback(
    (product: Product) => {
      const temperature = resolveItemTemperature(
        product,
        getSelectedTemperature(product)
      );
      const quarterPounderOption = resolveQuarterPounderOption(
        product,
        getSelectedQuarterPounderOption(product)
      );
      return encodeCartKey(product.id, temperature ?? quarterPounderOption);
    },
    [getSelectedTemperature, getSelectedQuarterPounderOption]
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
    if (isEditingPendingOrder) return;
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
      const effectiveVoucher = isNonMemberCustomer(customerId)
        ? "none"
        : voucherToApply;
      if (editingOrder) {
        const mergedItems = mergePurchaseItems(editingOrder.items, cartItems);
        const updated = await apiUpdatePendingOrder(editingOrder.id, {
          items: mergedItems,
          notes: notes.trim() || undefined,
          voucherToApply: effectiveVoucher,
        });
        setCart({});
        setEditingOrder(updated);
        setSuccess("Items added to pending order.");
        router.replace("/products");
      } else {
        await apiCreatePendingOrder({
          customerId,
          items: cartItems,
          notes: notes.trim() || undefined,
          voucherToApply: effectiveVoucher,
        });
        resetCheckout();
        setCustomerId(NON_MEMBER_CUSTOMER_ID);
        setSuccess("Added to pending orders.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEditingPendingOrder
            ? "Failed to update pending order."
            : "Failed to add pending order."
      );
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
      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-3">
        {filtered.map((product) => {
          const Icon = categoryIcon(product.category);
          const cartKey = cartKeyForProduct(product);
          const quantity = cart[cartKey] ?? 0;
          const selectedTemp = getSelectedTemperature(product);
          const selectedQuarterPounderOption =
            getSelectedQuarterPounderOption(product);
          const unitPrice = getUnitPrice(
            product,
            selectedTemp,
            selectedQuarterPounderOption
          );

          return (
            <Card key={product.id} size="sm" className="overflow-hidden">
              <CardHeader className="pb-2 sm:pb-3">
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-sm leading-snug sm:text-base">
                      {product.name}
                    </CardTitle>
                  </div>
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 sm:size-10 sm:rounded-xl dark:bg-amber-950 dark:text-amber-300">
                    <Icon className="size-3.5 sm:size-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2.5 sm:space-y-4">
                <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                  <Badge variant="secondary" className="text-[0.7rem] sm:text-xs">
                    {formatCurrency(unitPrice)}
                  </Badge>
                  {productQualifiesForPoints(product, selectedTemp) ? (
                    <Badge
                      variant="secondary"
                      className="bg-emerald-100 text-[0.7rem] text-emerald-800 sm:text-xs dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      +{loyaltyConfig.pointsPerDrink} pt
                    </Badge>
                  ) : !isDrinkCategory(product.category) ? (
                    <Badge variant="secondary" className="text-[0.7rem] sm:text-xs">
                      No points
                    </Badge>
                  ) : null}
                  {productIsHotOnlyDrink(product) && (
                    <Badge variant="outline" className="text-[0.7rem] sm:text-xs">
                      Hot only
                    </Badge>
                  )}
                  {productIsIcedOnlyDrink(product) && (
                    <Badge variant="outline" className="text-[0.7rem] sm:text-xs">
                      Iced only
                    </Badge>
                  )}
                </div>
                {productOffersHotCold(product) && (
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    {(["hot", "iced"] as const).map((temp) => (
                      <button
                        key={temp}
                        type="button"
                        onClick={() => setProductTemperature(product, temp)}
                        className={cn(
                          "rounded-md border px-1.5 py-1 text-[0.65rem] font-medium transition-colors sm:px-2 sm:py-1.5 sm:text-xs",
                          selectedTemp === temp
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        {formatTemperatureLabel(temp)}
                      </button>
                    ))}
                  </div>
                )}
                {productOffersQuarterPounderOptions(product) && (
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-[0.65rem] text-muted-foreground sm:text-xs">
                      Add-ons
                    </Label>
                    <div className="grid grid-cols-1 gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setProductQuarterPounderOption(product, undefined)
                        }
                        className={cn(
                          "rounded-md border px-1.5 py-1 text-left text-[0.65rem] font-medium transition-colors sm:px-2 sm:py-1.5 sm:text-xs",
                          !selectedQuarterPounderOption
                            ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        Plain
                      </button>
                      {(
                        [
                          {
                            value: "cheese" as const,
                            surcharge: QUARTER_POUNDER_CHEESE_SURCHARGE,
                          },
                          {
                            value: "tlc" as const,
                            surcharge: QUARTER_POUNDER_TLC_SURCHARGE,
                          },
                        ] as const
                      ).map(({ value, surcharge }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setProductQuarterPounderOption(product, value)
                          }
                          className={cn(
                            "rounded-md border px-1.5 py-1 text-left text-[0.65rem] font-medium transition-colors sm:px-2 sm:py-1.5 sm:text-xs",
                            selectedQuarterPounderOption === value
                              ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                              : "border-border hover:bg-muted/50"
                          )}
                        >
                          {formatQuarterPounderOptionLabel(value)} (+
                          {formatCurrency(surcharge)})
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center justify-center gap-1.5 sm:justify-start sm:gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-7 sm:size-8"
                      aria-label={`Decrease ${product.name}`}
                      onClick={() => updateQuantity(cartKey, -1)}
                      disabled={quantity === 0}
                    >
                      <Minus className="size-3.5 sm:size-4" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium sm:w-8">
                      {quantity}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-7 sm:size-8"
                      aria-label={`Increase ${product.name}`}
                      onClick={() => updateQuantity(cartKey, 1)}
                      disabled={quantity === 0}
                    >
                      <Plus className="size-3.5 sm:size-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={quantity > 0 ? "secondary" : "default"}
                    className={cn(
                      "h-7 w-full text-xs sm:h-8 sm:w-auto sm:text-sm",
                      quantity === 0
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : undefined
                    )}
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
            {isEditingPendingOrder
              ? `Add more items to ${editingOrder.customerName}'s pending order.`
              : `Build an order of drinks, frappés, and snacks for ${loyaltyConfig.programName}.`}
          </p>
        </div>

        {isEditingPendingOrder && (
          <div className="rounded-lg border border-emerald-600/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
            Adding items to{" "}
            <span className="font-medium">{editingOrder.customerName}</span>
            &apos;s pending order ({editingOrder.items.length} item
            {editingOrder.items.length === 1 ? "" : "s"} already queued).{" "}
            <Link
              href="/pending-orders"
              className="font-medium underline underline-offset-2"
            >
              Back to pending orders
            </Link>
          </div>
        )}

        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="drink">Drinks</TabsTrigger>
            <TabsTrigger value="frappe">Frappé</TabsTrigger>
            <TabsTrigger value="snack">Snacks</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="mt-4">
            {renderProductGrid("all")}
          </TabsContent>
          <TabsContent value="drink" className="mt-4">
            {renderProductGrid("drink")}
          </TabsContent>
          <TabsContent value="frappe" className="mt-4">
            {renderProductGrid("frappe")}
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
            {loyaltyConfig.pointsPerDrink} loyalty point each.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddToPendingOrder} className="space-y-4">
            <CustomerSelectField
              customerId={customerId}
              customers={customers}
              onCustomerIdChange={handleCustomerChange}
              onScanError={setError}
              disabled={isEditingPendingOrder}
            />

            {selectedCustomer && !isNonMemberCheckout && (
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
                  {cartProducts.map(
                    ({ product, quantity, temperature, quarterPounderOption }) => {
                    const unitPrice = getUnitPrice(
                      product,
                      temperature,
                      quarterPounderOption
                    );
                    return (
                    <div
                      key={`${product.id}:${temperature ?? quarterPounderOption ?? "plain"}`}
                      className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {product.name}
                          {quarterPounderOption
                            ? ` · ${formatQuarterPounderOptionLabel(quarterPounderOption)}`
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
                  +{displayPointsEarned}
                </span>
              </div>
            </div>

            {selectedCustomer &&
              displayPointsEarned > 0 &&
              streakPreview && (
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
                ? isEditingPendingOrder
                  ? "Updating..."
                  : "Adding..."
                : cartProducts.length > 0
                  ? isEditingPendingOrder
                    ? `Add Items to Order · ${formatCurrency(checkoutTotal.total)}`
                    : `Add to Pending Order · ${formatCurrency(checkoutTotal.total)}`
                  : isEditingPendingOrder
                    ? "Add Items to Order"
                    : "Add to Pending Order"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export function ProductsContent() {
  return (
    <Suspense
      fallback={
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading products…
        </p>
      }
    >
      <ProductsContentInner />
    </Suspense>
  );
}
