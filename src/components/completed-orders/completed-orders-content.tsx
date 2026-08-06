"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Coins,
  Download,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatQuarterPounderOptionLabel } from "@/lib/data/quarter-pounder-options";
import { formatPaymentTypeLabel } from "@/lib/data/pending-order-utils";
import {
  calculateCheckoutTotal,
  calculateProductPointsEarned,
  formatCurrency,
  getUnitPrice,
} from "@/lib/data/purchase-calculations";
import { fetchCompletedOrders, fetchProducts } from "@/lib/api/loyalty-client";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ListPagination } from "@/components/ui/list-pagination";
import type { CompletedOrder, Product, PurchaseItemInput } from "@/types";

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
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<CompletedOrderPeriod>("daily");
  const [referenceYmd, setReferenceYmd] = useState<ManilaYmd>(() =>
    getManilaTodayYmd()
  );

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
    </div>
  );
}
