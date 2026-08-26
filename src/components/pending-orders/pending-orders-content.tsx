"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Minus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatTemperatureLabel,
  productOffersHotCold,
  productIsIcedOnlyDrink,
  resolveItemTemperature,
} from "@/lib/data/drink-temperature";
import {
  formatQuarterPounderOptionLabel,
  productOffersQuarterPounderOptions,
  resolveQuarterPounderOption,
} from "@/lib/data/quarter-pounder-options";
import { formatPaymentTypeLabel } from "@/lib/data/pending-order-utils";
import {
  calculateCheckoutTotal,
  calculatePurchaseTotals,
  formatCurrency,
  getUnitPrice,
} from "@/lib/data/purchase-calculations";
import { isNonMemberCustomer } from "@/lib/data/non-member";
import {
  apiCompletePendingOrder,
  apiDeletePendingOrder,
  apiUpdatePendingOrder,
  fetchPendingOrders,
  fetchProducts,
} from "@/lib/api/loyalty-client";
import { fetchOrderPaymentStatus } from "@/lib/api/paymongo-client";
import { QrphCheckout } from "@/components/qrph/qrph-checkout";
import { formatTransactionDate } from "@/lib/format-date";
import { useLoyalty } from "@/hooks/use-loyalty";
import { cn } from "@/lib/utils";
import type {
  DrinkTemperature,
  PaymentType,
  PendingOrder,
  Product,
  PurchaseItemInput,
  QuarterPounderOption,
  QrphPaymentStatus,
  VoucherApplyOption,
} from "@/types";

function cartProductsFromItems(items: PurchaseItemInput[], products: Product[]) {
  return items.flatMap((item) => {
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
  });
}

export function PendingOrdersContent() {
  const { refresh, getCustomerById } = useLoyalty();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const [editingOrder, setEditingOrder] = useState<PendingOrder | null>(null);
  const [editItems, setEditItems] = useState<PurchaseItemInput[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editPaymentType, setEditPaymentType] = useState<PaymentType>("cash");
  const [editVoucherToApply, setEditVoucherToApply] =
    useState<VoucherApplyOption>("none");
  const [addProductId, setAddProductId] = useState("");
  const [addTemperature, setAddTemperature] = useState<DrinkTemperature>("hot");
  const [addQuarterPounderOption, setAddQuarterPounderOption] = useState<
    QuarterPounderOption | undefined
  >(undefined);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [qrphStatuses, setQrphStatuses] = useState<
    Record<string, QrphPaymentStatus | "none">
  >({});

  const loadQrphStatuses = useCallback(async (pendingOrders: PendingOrder[]) => {
    const entries = await Promise.all(
      pendingOrders.map(async (order) => {
        try {
          const status = await fetchOrderPaymentStatus(order.id);
          return [order.id, status.status] as const;
        } catch {
          return [order.id, "none"] as const;
        }
      })
    );
    setQrphStatuses(Object.fromEntries(entries));
  }, []);

  const loadOrders = useCallback(async () => {
    const [loadedOrders, loadedProducts] = await Promise.all([
      fetchPendingOrders(),
      fetchProducts(),
    ]);
    setOrders(loadedOrders);
    setProducts(loadedProducts);
    await loadQrphStatuses(loadedOrders);
  }, [loadQrphStatuses]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchPendingOrders(), fetchProducts()])
      .then(async ([loadedOrders, loadedProducts]) => {
        if (cancelled) return;
        setOrders(loadedOrders);
        setProducts(loadedProducts);
        await loadQrphStatuses(loadedOrders);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load pending orders.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadQrphStatuses]);

  function productName(productId: string) {
    return products.find((product) => product.id === productId)?.name ?? "Item";
  }

  function openEditDialog(order: PendingOrder) {
    setEditingOrder(order);
    setEditItems(order.items.map((item) => ({ ...item })));
    setEditNotes(order.notes);
    setEditPaymentType(order.paymentType);
    setEditVoucherToApply(
      isNonMemberCustomer(order.customerId) ? "none" : order.voucherToApply
    );
    setAddProductId("");
    setAddTemperature("hot");
    setAddQuarterPounderOption(undefined);
    setEditError(null);
  }

  const editingCustomer = editingOrder
    ? getCustomerById(editingOrder.customerId)
    : undefined;
  const isEditingNonMember = editingOrder
    ? isNonMemberCustomer(editingOrder.customerId)
    : false;

  const editPreview = useMemo(() => {
    const activeItems = editItems.filter((item) => item.quantity > 0);
    const cartProducts = cartProductsFromItems(activeItems, products);
    const effectiveVoucher = isEditingNonMember ? "none" : editVoucherToApply;
    const totals = calculatePurchaseTotals(
      activeItems,
      products,
      effectiveVoucher
    );
    const checkout = calculateCheckoutTotal(
      totals.subtotal,
      cartProducts,
      effectiveVoucher
    );
    return {
      ...checkout,
      pointsEarned: isEditingNonMember ? 0 : totals.pointsEarned,
    };
  }, [editItems, products, editVoucherToApply, isEditingNonMember]);

  const addProduct = products.find((product) => product.id === addProductId);

  function updateEditItemQuantity(index: number, delta: number) {
    setEditItems((current) =>
      current
        .map((item, itemIndex) => {
          if (itemIndex !== index) return item;
          return { ...item, quantity: item.quantity + delta };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function handleAddProductToEdit() {
    if (!addProduct) return;
    const temperature = resolveItemTemperature(addProduct, addTemperature);
    const quarterPounderOption = resolveQuarterPounderOption(
      addProduct,
      addQuarterPounderOption
    );
    const nextItem: PurchaseItemInput = {
      productId: addProduct.id,
      quantity: 1,
    };
    if (temperature) nextItem.temperature = temperature;
    if (quarterPounderOption) {
      nextItem.quarterPounderOption = quarterPounderOption;
    }

    setEditItems((current) => {
      const existingIndex = current.findIndex(
        (item) =>
          item.productId === nextItem.productId &&
          (item.temperature ?? "") === (nextItem.temperature ?? "") &&
          (item.quarterPounderOption ?? "") ===
            (nextItem.quarterPounderOption ?? "")
      );
      if (existingIndex === -1) return [...current, nextItem];
      return current.map((item, index) =>
        index === existingIndex
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
    });
  }

  async function handleSaveEdit() {
    if (!editingOrder) return;
    if (editItems.every((item) => item.quantity <= 0)) {
      setEditError("Add at least one product.");
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);
    setBusyOrderId(editingOrder.id);
    try {
      const updated = await apiUpdatePendingOrder(editingOrder.id, {
        items: editItems.filter((item) => item.quantity > 0),
        notes: editNotes,
        paymentType: editPaymentType,
        voucherToApply: isEditingNonMember ? "none" : editVoucherToApply,
      });
      setOrders((current) =>
        current.map((order) => (order.id === updated.id ? updated : order))
      );
      setEditingOrder(null);
      setSuccess(`Updated pending order for ${updated.customerName}.`);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update pending order."
      );
    } finally {
      setIsSavingEdit(false);
      setBusyOrderId(null);
    }
  }

  async function handleComplete(order: PendingOrder) {
    setError(null);
    setSuccess(null);
    setBusyOrderId(order.id);
    try {
      await apiCompletePendingOrder(order.id);
      await refresh();
      await loadOrders();
      setSuccess(
        `Completed order for ${order.customerName} · ${formatCurrency(order.total)}`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete order.");
    } finally {
      setBusyOrderId(null);
    }
  }

  async function handleRemove(order: PendingOrder) {
    setError(null);
    setSuccess(null);
    setBusyOrderId(order.id);
    try {
      await apiDeletePendingOrder(order.id);
      await loadOrders();
      setSuccess(`Removed pending order for ${order.customerName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove order.");
    } finally {
      setBusyOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Orders</h1>
          <p className="text-muted-foreground">
            Review queued orders from the Products page and complete them when
            ready.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/completed-orders"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Completed Orders
          </Link>
          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            Products
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
      )}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading pending orders…
        </p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <ClipboardList className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No pending orders</p>
              <p className="text-sm text-muted-foreground">
                Build an order on the Products page and choose Add to Pending Order.
              </p>
            </div>
            <Link
              href="/products"
              className={cn(
                buttonVariants({
                  className: "bg-emerald-600 hover:bg-emerald-700 text-white",
                })
              )}
            >
              Go to Products
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{order.customerName}</CardTitle>
                  <CardDescription>
                    Added {formatTransactionDate(order.createdAt)}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  {qrphStatuses[order.id] === "paid" && (
                    <Badge
                      variant="secondary"
                      className="w-fit bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    >
                      QR paid
                    </Badge>
                  )}
                  <Badge variant="secondary" className="w-fit">
                    {formatCurrency(order.total)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {order.items.map((item, index) => {
                    const product = products.find(
                      (entry) => entry.id === item.productId
                    );
                    if (!product) {
                      return (
                        <div
                          key={`${order.id}-${item.productId}-${index}`}
                          className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                        >
                          {item.quantity} × {productName(item.productId)}
                        </div>
                      );
                    }

                    const unitPrice = getUnitPrice(
                      product,
                      item.temperature,
                      item.quarterPounderOption
                    );
                    const lineTotal = unitPrice * item.quantity;

                    return (
                      <div
                        key={`${order.id}-${item.productId}-${item.temperature ?? item.quarterPounderOption ?? "snack"}-${index}`}
                        className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="font-medium">
                            {product.name}
                            {item.quarterPounderOption
                              ? ` · ${formatQuarterPounderOptionLabel(item.quarterPounderOption)}`
                              : ""}
                          </p>
                          <p className="text-muted-foreground">
                            {item.quantity} × {formatCurrency(unitPrice)}
                            {item.temperature
                              ? ` · ${formatTemperatureLabel(item.temperature)}`
                              : ""}
                          </p>
                        </div>
                        <p className="font-medium tabular-nums">
                          {formatCurrency(lineTotal)}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-indigo-700 dark:text-indigo-300">
                      <span>Voucher discount</span>
                      <span>−{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2 font-semibold">
                    <span>Total</span>
                    <span>{formatCurrency(order.total)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Points to award</span>
                    <span>+{order.pointsEarned}</span>
                  </div>
                </div>

                {order.notes && (
                  <p className="text-sm text-muted-foreground">
                    Notes: {order.notes}
                  </p>
                )}

                <p className="text-sm text-muted-foreground">
                  Payment: {formatPaymentTypeLabel(order.paymentType)}
                </p>

                {order.voucherToApply !== "none" && (
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    Voucher on completion:{" "}
                    {order.voucherToApply === "voucher"
                      ? loyaltyConfig.voucher.label
                      : loyaltyConfig.freeDrinkVoucher.label}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyOrderId === order.id}
                    onClick={() => handleRemove(order)}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyOrderId === order.id}
                    onClick={() => openEditDialog(order)}
                  >
                    <Pencil className="size-4" />
                    Edit
                  </Button>
                  <QrphCheckout
                    orderId={order.id}
                    amount={order.total}
                    customerName={order.customerName}
                    disabled={busyOrderId === order.id}
                    onPaid={() => {
                      setQrphStatuses((current) => ({
                        ...current,
                        [order.id]: "paid",
                      }));
                    }}
                  />
                  <Button
                    type="button"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    disabled={busyOrderId === order.id}
                    onClick={() => handleComplete(order)}
                  >
                    <CheckCircle2 className="size-4" />
                    {busyOrderId === order.id
                      ? "Processing..."
                      : `Complete Purchase · ${formatCurrency(order.total)}`}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={editingOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingOrder(null);
            setEditError(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit pending order</DialogTitle>
            <DialogDescription>
              Update items, voucher, payment, and notes for{" "}
              {editingOrder?.customerName ?? "this order"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Items</Label>
              {editItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items yet.</p>
              ) : (
                <div className="space-y-2">
                  {editItems.map((item, index) => {
                    const product = products.find(
                      (entry) => entry.id === item.productId
                    );
                    return (
                      <div
                        key={`${item.productId}-${item.temperature ?? ""}-${item.quarterPounderOption ?? ""}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {product?.name ?? "Item"}
                          </p>
                          <p className="text-muted-foreground">
                            {[
                              item.temperature
                                ? formatTemperatureLabel(item.temperature)
                                : null,
                              item.quarterPounderOption
                                ? formatQuarterPounderOptionLabel(
                                    item.quarterPounderOption
                                  )
                                : null,
                              product
                                ? formatCurrency(
                                    getUnitPrice(
                                      product,
                                      item.temperature,
                                      item.quarterPounderOption
                                    )
                                  )
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => updateEditItemQuantity(index, -1)}
                          >
                            <Minus className="size-3.5" />
                          </Button>
                          <span className="w-6 text-center tabular-nums">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="outline"
                            onClick={() => updateEditItemQuantity(index, 1)}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <Label htmlFor="add-pending-product">Add product</Label>
              <select
                id="add-pending-product"
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                value={addProductId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setAddProductId(nextId);
                  const nextProduct = products.find(
                    (product) => product.id === nextId
                  );
                  if (!nextProduct) return;
                  if (productIsIcedOnlyDrink(nextProduct)) {
                    setAddTemperature("iced");
                  } else {
                    setAddTemperature("hot");
                  }
                  setAddQuarterPounderOption(
                    productOffersQuarterPounderOptions(nextProduct)
                      ? "cheese"
                      : undefined
                  );
                }}
              >
                <option value="">Select a product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
              {addProduct && productOffersHotCold(addProduct) && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddTemperature("hot")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      addTemperature === "hot"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border"
                    )}
                  >
                    Hot
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddTemperature("iced")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      addTemperature === "iced"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border"
                    )}
                  >
                    Iced
                  </button>
                </div>
              )}
              {addProduct && productOffersQuarterPounderOptions(addProduct) && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAddQuarterPounderOption("cheese")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      addQuarterPounderOption === "cheese"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border"
                    )}
                  >
                    Cheese
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddQuarterPounderOption("tlc")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm",
                      addQuarterPounderOption === "tlc"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border"
                    )}
                  >
                    TLC
                  </button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={!addProductId}
                onClick={handleAddProductToEdit}
              >
                <Plus className="size-4" />
                Add to order
              </Button>
            </div>

            {!isEditingNonMember && editingCustomer && (
              <div className="space-y-2">
                <Label>Voucher</Label>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => setEditVoucherToApply("none")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm",
                      editVoucherToApply === "none"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border"
                    )}
                  >
                    No voucher
                  </button>
                  {editingCustomer.vouchersAvailable > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditVoucherToApply("voucher")}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm",
                        editVoucherToApply === "voucher"
                          ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                          : "border-border"
                      )}
                    >
                      {loyaltyConfig.voucher.label}
                    </button>
                  )}
                  {editingCustomer.freeDrinkVouchersAvailable > 0 && (
                    <button
                      type="button"
                      onClick={() => setEditVoucherToApply("free-drink-voucher")}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm",
                        editVoucherToApply === "free-drink-voucher"
                          ? "border-amber-600 bg-amber-50 dark:bg-amber-950/40"
                          : "border-border"
                      )}
                    >
                      {loyaltyConfig.freeDrinkVoucher.label}
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Payment type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditPaymentType("cash")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    editPaymentType === "cash"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  Cash
                </button>
                <button
                  type="button"
                  onClick={() => setEditPaymentType("gcash")}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    editPaymentType === "gcash"
                      ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  GCash
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="pending-order-notes">Notes</Label>
              <Textarea
                id="pending-order-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Optional notes"
              />
            </div>

            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(editPreview.subtotal)}</span>
              </div>
              {editPreview.discount > 0 && (
                <div className="flex justify-between text-indigo-700 dark:text-indigo-300">
                  <span>{editPreview.discountLabel ?? "Discount"}</span>
                  <span>−{formatCurrency(editPreview.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(editPreview.total)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Points</span>
                <span>+{editPreview.pointsEarned}</span>
              </div>
            </div>

            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSavingEdit}
              onClick={() => setEditingOrder(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={isSavingEdit || editItems.length === 0}
              onClick={handleSaveEdit}
            >
              {isSavingEdit ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
