"use client";

import { useState } from "react";
import { Coffee } from "lucide-react";
import { loyaltyConfig, calculatePointsFromDrinks, applyStreakPointsEarned } from "@/config/loyalty";
import { CustomerSelectField } from "@/components/dashboard/customer-select-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useLoyalty } from "@/hooks/use-loyalty";
import { formatCurrency } from "@/lib/data/purchase-calculations";
import { cn } from "@/lib/utils";
import type { PaymentType } from "@/types";

export function LogPurchaseDialog() {
  const { customers, logPurchase } = useLoyalty();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [drinkCount, setDrinkCount] = useState("");
  const [additionalSales, setAdditionalSales] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>("cash");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const countNum = parseInt(drinkCount, 10) || 0;
  const additionalSalesNum =
    additionalSales.trim() === "" ? 0 : Number(additionalSales);
  const previewPoints = calculatePointsFromDrinks(countNum);
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const streakPreview =
    selectedCustomer && countNum > 0
      ? applyStreakPointsEarned(
          selectedCustomer.consecutivePointsEarned,
          previewPoints
        )
      : null;

  function reset() {
    setCustomerId("");
    setDrinkCount("");
    setAdditionalSales("");
    setPaymentType("cash");
    setNotes("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a customer.");
      return;
    }
    if (countNum <= 0 || !Number.isInteger(countNum)) {
      setError("Enter a valid number of coffee drinks.");
      return;
    }
    if (
      additionalSales.trim() !== "" &&
      (!Number.isInteger(additionalSalesNum) || additionalSalesNum < 0)
    ) {
      setError("Additional sales must be a whole peso amount of 0 or more.");
      return;
    }
    try {
      await logPurchase({
        customerId,
        drinkCount: countNum,
        notes,
        additionalSales: additionalSalesNum,
        paymentType,
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Coffee className="size-4" />
        Log Coffee
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Log Coffee Drinks</DialogTitle>
            <DialogDescription>
              Award {loyaltyConfig.pointsPerDrink} point per {loyaltyConfig.drinkLabel}.
              The {loyaltyConfig.streak.halfOffAt}th consecutive point earns a{" "}
              {loyaltyConfig.voucher.label.toLowerCase()}. The{" "}
              {loyaltyConfig.streak.cycleLength}th earns a{" "}
              {loyaltyConfig.freeDrinkVoucher.label.toLowerCase()}, resets the streak,
              and deducts {loyaltyConfig.streak.cycleLength} points from balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <CustomerSelectField
              customerId={customerId}
              customers={customers}
              onCustomerIdChange={setCustomerId}
              onScanError={setError}
            />
            <div className="grid gap-2">
              <Label htmlFor="drinkCount">Coffee Drinks</Label>
              <Input
                id="drinkCount"
                type="number"
                min="1"
                step="1"
                value={drinkCount}
                onChange={(e) => setDrinkCount(e.target.value)}
                placeholder="1"
              />
              {countNum > 0 && (
                <div className="space-y-1">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400">
                    +{previewPoints} point{previewPoints !== 1 ? "s" : ""} will be awarded
                  </p>
                  {streakPreview && streakPreview.vouchersEarned > 0 && (
                    <p className="text-sm text-indigo-600 dark:text-indigo-400">
                      +{streakPreview.vouchersEarned} {loyaltyConfig.voucher.label}
                      {streakPreview.vouchersEarned !== 1 ? "s" : ""} will be awarded
                    </p>
                  )}
                  {streakPreview && streakPreview.freeDrinkVouchersEarned > 0 && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      +{streakPreview.freeDrinkVouchersEarned}{" "}
                      {loyaltyConfig.freeDrinkVoucher.label}
                      {streakPreview.freeDrinkVouchersEarned !== 1 ? "s" : ""} will be
                      awarded · streak and {streakPreview.pointsReset} points reset
                    </p>
                  )}
                  {selectedCustomer && streakPreview && (
                    <p className="text-sm text-muted-foreground">
                      Balance after:{" "}
                      {Math.max(
                        0,
                        selectedCustomer.points + previewPoints - streakPreview.pointsReset
                      )}{" "}
                      pts
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="additionalSales">Additional sales (optional)</Label>
              <Input
                id="additionalSales"
                type="number"
                min="0"
                step="1"
                value={additionalSales}
                onChange={(e) => setAdditionalSales(e.target.value)}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">
                Snacks or other items sold with this coffee. Does not earn points.
              </p>
              {additionalSalesNum > 0 && (
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(additionalSalesNum)} will be added to completed-order
                  revenue.
                </p>
              )}
            </div>
            {additionalSalesNum > 0 && (
              <div className="grid gap-2">
                <Label>Payment type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentType("cash")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      paymentType === "cash"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentType("gcash")}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      paymentType === "gcash"
                        ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    GCash
                  </button>
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Latte, cappuccino"
                rows={2}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Add Points
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
