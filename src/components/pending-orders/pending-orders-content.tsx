"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, ClipboardList, Trash2 } from "lucide-react";
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
import { formatTemperatureLabel } from "@/lib/data/drink-temperature";
import { formatCurrency } from "@/lib/data/purchase-calculations";
import {
  apiCompletePendingOrder,
  apiDeletePendingOrder,
  fetchPendingOrders,
  fetchProducts,
} from "@/lib/api/loyalty-client";
import { formatTransactionDate } from "@/lib/format-date";
import { useLoyalty } from "@/hooks/use-loyalty";
import { cn } from "@/lib/utils";
import type { PendingOrder, Product } from "@/types";

export function PendingOrdersContent() {
  const { refresh } = useLoyalty();
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const [loadedOrders, loadedProducts] = await Promise.all([
      fetchPendingOrders(),
      fetchProducts(),
    ]);
    setOrders(loadedOrders);
    setProducts(loadedProducts);
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadOrders()
      .catch(() => {
        if (!cancelled) setError("Failed to load pending orders.");
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
            Add More Items
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
                <Badge variant="secondary" className="w-fit">
                  {formatCurrency(order.total)}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {order.items.map((item, index) => (
                    <div
                      key={`${order.id}-${item.productId}-${item.temperature ?? "snack"}-${index}`}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span>
                        {item.quantity} × {productName(item.productId)}
                        {item.temperature
                          ? ` · ${formatTemperatureLabel(item.temperature)}`
                          : ""}
                      </span>
                    </div>
                  ))}
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

                {order.voucherToApply !== "none" && (
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    Voucher on completion:{" "}
                    {order.voucherToApply === "voucher"
                      ? loyaltyConfig.voucher.label
                      : loyaltyConfig.freeDrinkVoucher.label}
                  </p>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
    </div>
  );
}
