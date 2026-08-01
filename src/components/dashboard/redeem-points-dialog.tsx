"use client";

import { useState } from "react";
import { Coffee, Gift, Ticket } from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
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
import { cn } from "@/lib/utils";
import { useLoyalty } from "@/hooks/use-loyalty";

const voucherReward = loyaltyConfig.voucher;
const freeDrinkVoucherReward = loyaltyConfig.freeDrinkVoucher;

type RedeemMode = "free-drink-voucher" | "voucher" | "custom";

export function RedeemPointsDialog() {
  const { customers, redeemPoints, redeemVoucher, redeemFreeDrinkVoucher } =
    useLoyalty();
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [mode, setMode] = useState<RedeemMode>("free-drink-voucher");
  const [quantity, setQuantity] = useState("1");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const selected = customers.find((c) => c.id === customerId);
  const pointsNum = parseInt(points, 10) || 0;
  const quantityNum = parseInt(quantity, 10) || 0;

  const maxFreeDrink = selected?.freeDrinkVouchersAvailable ?? 0;
  const maxFiftyOff = selected?.vouchersAvailable ?? 0;

  const effectiveQty =
    mode === "free-drink-voucher"
      ? Math.min(quantityNum, maxFreeDrink)
      : mode === "voucher"
        ? Math.min(quantityNum, maxFiftyOff)
        : quantityNum;

  function reset() {
    setCustomerId("");
    setMode("free-drink-voucher");
    setQuantity("1");
    setPoints("");
    setReason("");
    setError("");
  }

  function selectMode(next: RedeemMode) {
    setMode(next);
    setQuantity("1");
    setPoints("");
    setReason("");
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) {
      setError("Please select a customer.");
      return;
    }

    try {
      if (mode === "voucher") {
        if (maxFiftyOff <= 0) {
          setError("No vouchers available for this customer.");
          return;
        }
        if (quantityNum <= 0) {
          setError("Enter a valid voucher quantity.");
          return;
        }
        if (quantityNum > maxFiftyOff) {
          setError(`Only ${maxFiftyOff} voucher(s) in stack.`);
          return;
        }
        await redeemVoucher({
          customerId,
          count: quantityNum,
          reason: reason.trim() || undefined,
        });
      } else if (mode === "free-drink-voucher") {
        if (maxFreeDrink <= 0) {
          setError("No free drink vouchers available for this customer.");
          return;
        }
        if (quantityNum <= 0) {
          setError("Enter a valid voucher quantity.");
          return;
        }
        if (quantityNum > maxFreeDrink) {
          setError(`Only ${maxFreeDrink} voucher(s) in stack.`);
          return;
        }
        await redeemFreeDrinkVoucher({
          customerId,
          count: quantityNum,
          reason: reason.trim() || undefined,
        });
      } else {
        if (pointsNum <= 0) {
          setError("Enter a valid point amount.");
          return;
        }
        await redeemPoints({
          customerId,
          points: pointsNum,
          reason: reason.trim() || undefined,
        });
      }
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const submitDisabled =
    (mode === "voucher" && !!selected && (maxFiftyOff <= 0 || quantityNum <= 0)) ||
    (mode === "free-drink-voucher" &&
      !!selected &&
      (maxFreeDrink <= 0 || quantityNum <= 0));

  const submitLabel =
    mode === "free-drink-voucher"
      ? quantityNum > 1
        ? `Use ${quantityNum} Free Drink Vouchers`
        : "Use Free Drink Voucher"
      : mode === "voucher"
        ? quantityNum > 1
          ? `Use ${quantityNum} Vouchers`
          : "Use Voucher"
        : "Redeem";

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Gift className="size-4" />
        Redeem
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Redeem Reward</DialogTitle>
            <DialogDescription>
              Vouchers stack across streak cycles. Redeeming vouchers does not
              affect points balance or streak.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <CustomerSelectField
              customerId={customerId}
              customers={customers}
              onCustomerIdChange={setCustomerId}
              onScanError={setError}
            />

            {selected && (
              <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">Voucher stack</p>
                <p className="text-muted-foreground">
                  {selected.vouchersAvailable} × {voucherReward.label}
                  {selected.vouchersAvailable !== 1 ? "s" : ""} ·{" "}
                  {selected.freeDrinkVouchersAvailable} ×{" "}
                  {freeDrinkVoucherReward.label}
                  {selected.freeDrinkVouchersAvailable !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Reward</Label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => selectMode("free-drink-voucher")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    mode === "free-drink-voucher"
                      ? "border-amber-600 bg-amber-50 dark:bg-amber-950/40"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Coffee className="size-4 text-amber-600" />
                    {freeDrinkVoucherReward.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    From stack
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMode("voucher")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    mode === "voucher"
                      ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Ticket className="size-4 text-indigo-600" />
                    {voucherReward.label}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    From stack
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => selectMode("custom")}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors",
                    mode === "custom"
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                      : "border-border hover:bg-muted/50"
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Gift className="size-4 text-emerald-600" />
                    Custom
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Any points
                  </span>
                </button>
              </div>
            </div>

            {mode === "custom" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="points">Points to Redeem</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    step="1"
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="reason">Reason (optional)</Label>
                  <Input
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Special promotion"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    max={
                      mode === "free-drink-voucher"
                        ? maxFreeDrink || undefined
                        : maxFiftyOff || undefined
                    }
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Does not deduct points or reset the consecutive streak.
                </p>
              </>
            )}

            {selected && mode === "voucher" && maxFiftyOff <= 0 && (
              <p className="text-sm text-destructive">No vouchers in stack.</p>
            )}

            {selected && mode === "voucher" && effectiveQty > 0 && maxFiftyOff > 0 && (
              <p className="text-sm text-muted-foreground">
                Stack after: {Math.max(0, selected.vouchersAvailable - effectiveQty)}
              </p>
            )}

            {selected && mode === "free-drink-voucher" && maxFreeDrink <= 0 && (
              <p className="text-sm text-destructive">No free drink vouchers in stack.</p>
            )}

            {selected && mode === "free-drink-voucher" && effectiveQty > 0 && maxFreeDrink > 0 && (
              <p className="text-sm text-muted-foreground">
                Stack after: {Math.max(0, selected.freeDrinkVouchersAvailable - effectiveQty)}
              </p>
            )}

            {selected && mode === "custom" && pointsNum > 0 && (
              <p className="text-sm text-muted-foreground">
                Balance after: {Math.max(0, selected.points - pointsNum)} pts ·
                consecutive streak resets
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={submitDisabled}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
