"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt, Scale, TrendingDown, TrendingUp } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCompletedOrders,
  fetchExpenses,
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
import { formatCurrency } from "@/lib/data/purchase-calculations";
import { cn } from "@/lib/utils";
import type { CompletedOrder, Expense } from "@/types";

function sumOrderRevenue(orders: CompletedOrder[]) {
  let total = 0;
  let cashTotal = 0;
  let gcashTotal = 0;

  for (const order of orders) {
    total += order.total;
    if (order.paymentType === "gcash") {
      gcashTotal += order.total;
    } else {
      cashTotal += order.total;
    }
  }

  return { count: orders.length, total, cashTotal, gcashTotal };
}

function sumExpenses(expenses: Expense[]) {
  let total = 0;
  let cashTotal = 0;
  let gcashTotal = 0;

  for (const expense of expenses) {
    total += expense.amount;
    if (expense.paymentType === "gcash") {
      gcashTotal += expense.amount;
    } else {
      cashTotal += expense.amount;
    }
  }

  return { count: expenses.length, total, cashTotal, gcashTotal };
}

export function SummaryContent() {
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<CompletedOrderPeriod>("monthly");
  const [referenceYmd, setReferenceYmd] = useState<ManilaYmd>(() =>
    getManilaTodayYmd()
  );

  const referenceDate = useMemo(
    () => ymdToReferenceDate(referenceYmd),
    [referenceYmd]
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchCompletedOrders(), fetchExpenses()])
      .then(([loadedOrders, loadedExpenses]) => {
        if (cancelled) return;
        setOrders(loadedOrders);
        setExpenses(loadedExpenses);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load summary.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        isCompletedOrderInPeriod(order.completedAt, period, referenceDate)
      ),
    [orders, period, referenceDate]
  );

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        isCompletedOrderInPeriod(expense.incurredAt, period, referenceDate)
      ),
    [expenses, period, referenceDate]
  );

  const revenue = useMemo(
    () => sumOrderRevenue(filteredOrders),
    [filteredOrders]
  );
  const expenseTotals = useMemo(
    () => sumExpenses(filteredExpenses),
    [filteredExpenses]
  );
  const net = revenue.total - expenseTotals.total;

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
  const earliestYear = useMemo(() => {
    const years = [
      ...orders.map((order) => toManilaYmd(order.completedAt).year),
      ...expenses.map((expense) => toManilaYmd(expense.incurredAt).year),
    ];
    if (years.length === 0) return referenceYmd.year;
    return Math.min(...years);
  }, [orders, expenses, referenceYmd.year]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Summary</h1>
          <p className="text-muted-foreground">
            Total revenue, expenses, and net for the selected period.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/completed-orders"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Completed Orders
          </Link>
          <Link
            href="/expenses"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Expenses
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading summary…
        </p>
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
                  <Label htmlFor="summary-date">
                    {period === "daily" ? "Select day" : "Select week"}
                  </Label>
                  <Input
                    id="summary-date"
                    type="date"
                    value={formatYmdForDateInput(referenceYmd)}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
              {period === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="summary-month">Select month</Label>
                  <Input
                    id="summary-month"
                    type="month"
                    value={formatYmdForMonthInput(referenceYmd)}
                    onChange={(e) => handleMonthInputChange(e.target.value)}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
              {period === "yearly" && (
                <div className="space-y-2">
                  <Label htmlFor="summary-year">Select year</Label>
                  <Input
                    id="summary-year"
                    type="number"
                    min={earliestYear}
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

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingUp className="size-4" />
                  Total Revenue
                </CardDescription>
                <CardTitle className="text-3xl">
                  {formatCurrency(revenue.total)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(revenue.cashTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GCash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(revenue.gcashTotal)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {revenue.count} completed order{revenue.count !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <TrendingDown className="size-4" />
                  Total Expense
                </CardDescription>
                <CardTitle className="text-3xl">
                  {formatCurrency(expenseTotals.total)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(expenseTotals.cashTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GCash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(expenseTotals.gcashTotal)}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {expenseTotals.count} expense
                  {expenseTotals.count !== 1 ? "s" : ""}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Scale className="size-4" />
                  Revenue − Expenses
                </CardDescription>
                <CardTitle
                  className={cn(
                    "text-3xl",
                    net < 0
                      ? "text-destructive"
                      : "text-emerald-600 dark:text-emerald-400"
                  )}
                >
                  {formatCurrency(net)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {net < 0
                  ? `Expenses exceed revenue by ${formatCurrency(Math.abs(net))} ${periodLabel}.`
                  : `Net remaining after expenses ${periodLabel}.`}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="size-4 text-emerald-600" />
                Period snapshot
              </CardTitle>
              <CardDescription>
                {formatCurrency(revenue.total)} revenue −{" "}
                {formatCurrency(expenseTotals.total)} expenses ={" "}
                {formatCurrency(net)} net {periodLabel}.
              </CardDescription>
            </CardHeader>
          </Card>
        </>
      )}
    </div>
  );
}
