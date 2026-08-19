"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  Download,
  Minus,
  Pencil,
  Plus,
  ShoppingBag,
  Ticket,
  TrendingUp,
  Users,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateCheckoutTotal,
  calculateProductPointsEarned,
  calculatePurchaseTotals,
  formatCurrency,
  getUnitPrice,
} from "@/lib/data/purchase-calculations";
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
import { isNonMemberCustomer } from "@/lib/data/non-member";
import {
  apiUpdateCompletedOrder,
  fetchCompletedOrders,
  fetchProducts,
} from "@/lib/api/loyalty-client";
import {
  COMPLETED_ORDER_PERIODS,
  formatYmdForDateInput,
  formatYmdForMonthInput,
  getCompletedOrderPeriodLabel,
  getCompletedOrderPeriodRangeLabel,
  getManilaTodayYmd,
  isCompletedOrderInPeriod,
  isCurrentPeriodSelection,
  toManilaYmd,
  ymdToReferenceDate,
  type CompletedOrderPeriod,
  type ManilaYmd,
} from "@/lib/completed-order-period";
import { formatTransactionDate } from "@/lib/format-date";
import { exportCompletedOrdersToExcel } from "@/lib/export/completed-orders-excel";
import { usePagination, CUSTOMER_PAGE_SIZE } from "@/hooks/use-pagination";
import { useLoyalty } from "@/hooks/use-loyalty";
import { useAuth } from "@/hooks/use-auth";
import { canEditCompletedOrders } from "@/config/auth";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ui/list-pagination";
import type {
  CompletedOrder,
  DrinkTemperature,
  PaymentType,
  Product,
  PurchaseItemInput,
  QuarterPounderOption,
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

function computeOrderCheckout(order: CompletedOrder, products: Product[]) {
  const cartProducts = cartProductsFromItems(order.items, products);
  return calculateCheckoutTotal(
    order.subtotal,
    cartProducts,
    order.voucherToApply
  );
}

function computeOrderStats(orders: CompletedOrder[]) {
  const customerIds = new Set<string>();
  let totalRevenue = 0;
  let cashRevenue = 0;
  let gcashRevenue = 0;
  let totalDiscount = 0;
  let totalPoints = 0;
  let itemsSold = 0;
  let voucherOrders = 0;

  for (const order of orders) {
    customerIds.add(order.customerId);
    totalRevenue += order.total;
    if (order.paymentType === "gcash") {
      gcashRevenue += order.total;
    } else {
      cashRevenue += order.total;
    }
    totalDiscount += order.discount;
    totalPoints += order.pointsEarned;
    itemsSold += order.items.reduce((sum, item) => sum + item.quantity, 0);
    if (order.voucherToApply !== "none") voucherOrders += 1;
  }

  return {
    orderCount: orders.length,
    customerCount: customerIds.size,
    totalRevenue,
    cashRevenue,
    gcashRevenue,
    totalDiscount,
    totalPoints,
    itemsSold,
    voucherOrders,
    averageOrder: orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0,
  };
}

export function CompletedOrdersContent() {
  const { refresh, getCustomerById } = useLoyalty();
  const { username } = useAuth();
  const canEditOrders = canEditCompletedOrders(username);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<CompletedOrderPeriod>("daily");
  const [referenceYmd, setReferenceYmd] = useState<ManilaYmd>(() =>
    getManilaTodayYmd()
  );
  const [editingOrder, setEditingOrder] = useState<CompletedOrder | null>(null);
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
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const referenceDate = useMemo(
    () => ymdToReferenceDate(referenceYmd),
    [referenceYmd]
  );

  function resetToCurrentPeriod() {
    setReferenceYmd(getManilaTodayYmd());
  }

  function handleDateInputChange(value: string) {
    if (!value) return;
    const [year, month, day] = value.split("-").map(Number);
    setReferenceYmd({ year, month, day });
  }

  function handleMonthInputChange(value: string) {
    if (!value) return;
    const [year, month] = value.split("-").map(Number);
    setReferenceYmd({ year, month, day: 1 });
  }

  function handleYearInputChange(value: string) {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000) return;
    setReferenceYmd({ year, month: 1, day: 1 });
  }

  const loadOrders = useCallback(async () => {
    const [loadedOrders, loadedProducts] = await Promise.all([
      fetchCompletedOrders(),
      fetchProducts(),
    ]);
    setOrders(loadedOrders);
    setProducts(loadedProducts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadOrders()
      .catch(() => {
        if (!cancelled) setError("Failed to load completed orders.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadOrders]);

  function productName(productId: string) {
    return products.find((product) => product.id === productId)?.name ?? "Item";
  }

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        isCompletedOrderInPeriod(order.completedAt, period, referenceDate)
      ),
    [orders, period, referenceDate]
  );

  const stats = useMemo(() => computeOrderStats(filteredOrders), [filteredOrders]);
  const {
    paginatedItems: paginatedOrders,
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems,
  } = usePagination(filteredOrders, CUSTOMER_PAGE_SIZE, `${period}-${referenceYmd.year}-${referenceYmd.month}-${referenceYmd.day}`);
  const periodRangeLabel = useMemo(
    () => getCompletedOrderPeriodRangeLabel(period, referenceDate),
    [period, referenceDate]
  );
  const periodLabel = useMemo(
    () => getCompletedOrderPeriodLabel(period, referenceYmd),
    [period, referenceYmd]
  );
  const isCurrentSelection = useMemo(
    () => isCurrentPeriodSelection(period, referenceYmd),
    [period, referenceYmd]
  );
  const earliestOrderYear = useMemo(() => {
    if (orders.length === 0) return referenceYmd.year;
    return Math.min(...orders.map((order) => toManilaYmd(order.completedAt).year));
  }, [orders, referenceYmd.year]);

  function openEditDialog(order: CompletedOrder) {
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
      const updated = await apiUpdateCompletedOrder(editingOrder.id, {
        items: editItems.filter((item) => item.quantity > 0),
        notes: editNotes,
        paymentType: editPaymentType,
        voucherToApply: isEditingNonMember ? "none" : editVoucherToApply,
      });
      setOrders((current) =>
        current.map((order) => (order.id === updated.id ? updated : order))
      );
      setEditingOrder(null);
      await refresh();
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update completed order."
      );
    } finally {
      setIsSavingEdit(false);
      setBusyOrderId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Completed Orders</h1>
          <p className="text-muted-foreground">
            Purchase history for orders completed from the pending queue.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={filteredOrders.length === 0}
            onClick={() =>
              exportCompletedOrdersToExcel({
                orders: filteredOrders,
                products,
                periodLabel,
                periodRangeLabel,
                stats,
              })
            }
          >
            <Download className="size-4" />
            Export Excel
          </Button>
          <Link
            href="/pending-orders"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            View Pending Orders
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading completed orders…
        </p>
      ) : orders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="size-10 text-muted-foreground" />
            <div>
              <p className="font-medium">No completed orders yet</p>
              <p className="text-sm text-muted-foreground">
                Completed purchases from Pending Orders will appear here.
              </p>
            </div>
            <Link
              href="/pending-orders"
              className={cn(
                buttonVariants({
                  className: "bg-emerald-600 hover:bg-emerald-700 text-white",
                })
              )}
            >
              Go to Pending Orders
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <Tabs
              value={period}
              onValueChange={(value) => setPeriod(value as CompletedOrderPeriod)}
            >
              <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
                {COMPLETED_ORDER_PERIODS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {(period === "daily" || period === "weekly") && (
                <div className="space-y-2">
                  <Label htmlFor="completed-orders-date">
                    {period === "daily" ? "Select day" : "Select week"}
                  </Label>
                  <Input
                    id="completed-orders-date"
                    type="date"
                    value={formatYmdForDateInput(referenceYmd)}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
              {period === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="completed-orders-month">Select month</Label>
                  <Input
                    id="completed-orders-month"
                    type="month"
                    value={formatYmdForMonthInput(referenceYmd)}
                    onChange={(e) => handleMonthInputChange(e.target.value)}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
              {period === "yearly" && (
                <div className="space-y-2">
                  <Label htmlFor="completed-orders-year">Select year</Label>
                  <Input
                    id="completed-orders-year"
                    type="number"
                    min={earliestOrderYear}
                    max={getManilaTodayYmd().year + 1}
                    value={referenceYmd.year}
                    onChange={(e) => handleYearInputChange(e.target.value)}
                    className="w-full sm:w-[120px]"
                  />
                </div>
              )}
              {!isCurrentSelection && (
                <Button type="button" variant="outline" onClick={resetToCurrentPeriod}>
                  Current period
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing results for {periodLabel} · {periodRangeLabel}
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <ShoppingBag className="size-4" />
                  Total Orders
                </CardDescription>
                <CardTitle className="text-3xl">{stats.orderCount}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {stats.itemsSold} item{stats.itemsSold !== 1 ? "s" : ""} sold
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Total Revenue
                </CardDescription>
                <CardTitle className="text-3xl">
                  {formatCurrency(stats.totalRevenue)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(stats.cashRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GCash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(stats.gcashRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Coins className="size-4" />
                  Points Awarded
                </CardDescription>
                <CardTitle className="text-3xl">
                  {stats.totalPoints.toLocaleString()}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Across {stats.customerCount} customer
                {stats.customerCount !== 1 ? "s" : ""}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Ticket className="size-4" />
                  Voucher Savings
                </CardDescription>
                <CardTitle className="text-3xl">
                  {formatCurrency(stats.totalDiscount)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {stats.voucherOrders} order{stats.voucherOrders !== 1 ? "s" : ""}{" "}
                used a voucher
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-emerald-600" />
                Summary
              </CardTitle>
              <CardDescription>
                {stats.orderCount} completed order{stats.orderCount !== 1 ? "s" : ""}{" "}
                {periodLabel} from {stats.customerCount} customer
                {stats.customerCount !== 1 ? "s" : ""} ·{" "}
                {formatCurrency(stats.totalRevenue)} gross revenue (
                Cash {formatCurrency(stats.cashRevenue)}, GCash{" "}
                {formatCurrency(stats.gcashRevenue)}) ·{" "}
                {formatCurrency(stats.totalDiscount)} in voucher discounts ·{" "}
                {stats.totalPoints.toLocaleString()} points issued
              </CardDescription>
            </CardHeader>
          </Card>

          {filteredOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No completed orders {periodLabel}.
              </CardContent>
            </Card>
          ) : (
          <>
          <div className="grid gap-4">
          {paginatedOrders.map((order) => {
            const checkout = computeOrderCheckout(order, products);

            return (
            <Card key={order.id}>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle>{order.customerName}</CardTitle>
                  <CardDescription>
                    Completed {formatTransactionDate(order.completedAt)}
                    {order.createdAt !== order.completedAt && (
                      <>
                        {" "}
                        · queued {formatTransactionDate(order.createdAt)}
                      </>
                    )}
                  </CardDescription>
                </div>
                <Badge className="w-fit bg-emerald-600 text-white hover:bg-emerald-600">
                  {formatCurrency(order.total)}
                </Badge>
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
                    const linePoints = calculateProductPointsEarned(
                      product,
                      item.quantity,
                      item.temperature
                    );

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
                          </p>
                          {linePoints > 0 && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">
                              +{linePoints} point{linePoints !== 1 ? "s" : ""}
                            </p>
                          )}
                        </div>
                        <p className="font-medium">{formatCurrency(lineTotal)}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="rounded-lg border bg-muted/30 px-3 py-3 text-sm space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      {formatCurrency(order.subtotal)}
                    </span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-indigo-700 dark:text-indigo-300">
                      <span>{checkout.discountLabel ?? "Voucher discount"}</span>
                      <span className="font-medium">
                        −{formatCurrency(order.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold">Total</span>
                    <span className="text-base font-semibold">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t pt-2 text-muted-foreground">
                    <span>Points awarded</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">
                      +{order.pointsEarned}
                    </span>
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
                    Voucher applied:{" "}
                    {order.voucherToApply === "voucher"
                      ? loyaltyConfig.voucher.label
                      : loyaltyConfig.freeDrinkVoucher.label}
                  </p>
                )}

                {canEditOrders && (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyOrderId === order.id}
                      onClick={() => openEditDialog(order)}
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
            );
          })}
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
          </>
          )}
        </>
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
            <DialogTitle>Edit completed order</DialogTitle>
            <DialogDescription>
              Update items, voucher, payment, and notes for{" "}
              {editingOrder?.customerName ?? "this order"}. Points and totals
              will be recalculated and loyalty balances will be adjusted.
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
              <Label htmlFor="add-completed-product">Add product</Label>
              <select
                id="add-completed-product"
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
                  {(editingCustomer.vouchersAvailable > 0 ||
                    editingOrder?.voucherToApply === "voucher") && (
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
                  {(editingCustomer.freeDrinkVouchersAvailable > 0 ||
                    editingOrder?.voucherToApply === "free-drink-voucher") && (
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
              <Label htmlFor="completed-order-notes">Notes</Label>
              <Textarea
                id="completed-order-notes"
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
