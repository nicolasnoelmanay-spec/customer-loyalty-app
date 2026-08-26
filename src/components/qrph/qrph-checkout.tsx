"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  apiCreateQrphCheckout,
  fetchOrderPaymentStatus,
} from "@/lib/api/paymongo-client";
import { formatCurrency } from "@/lib/data/purchase-calculations";

interface QrphCheckoutProps {
  orderId: string;
  amount: number;
  customerName: string;
  disabled?: boolean;
  onPaid?: () => void;
}

export function QrphCheckout({
  orderId,
  amount,
  customerName,
  disabled = false,
  onPaid,
}: QrphCheckoutProps) {
  const [open, setOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting for payment…");
  const [isPaid, setIsPaid] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const handledPaidRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetDialog = useCallback(() => {
    stopPolling();
    setQrCodeUrl(null);
    setPaymentIntentId(null);
    setError(null);
    setStatusMessage("Waiting for payment…");
    setIsPaid(false);
    handledPaidRef.current = false;
  }, [stopPolling]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  async function handleStartCheckout() {
    setIsStarting(true);
    setError(null);
    setIsPaid(false);
    handledPaidRef.current = false;
    try {
      const result = await apiCreateQrphCheckout({ orderId, amount });
      setQrCodeUrl(result.qrCodeUrl);
      setPaymentIntentId(result.paymentIntentId);
      setOpen(true);
      setStatusMessage("Scan the QR code with GCash, Maya, or a bank app.");

      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status = await fetchOrderPaymentStatus(orderId);
          if (status.status === "paid" && !handledPaidRef.current) {
            handledPaidRef.current = true;
            stopPolling();
            setIsPaid(true);
            setStatusMessage(
              status.pendingOrderExists
                ? "Payment confirmed. Order stays in Pending — tap Complete when ready."
                : "Payment confirmed, but this pending order is no longer in the queue."
            );
            onPaid?.();
            return;
          }
          if (!status.pendingOrderExists && status.status !== "paid") {
            setStatusMessage(
              "This pending order left the queue before payment was confirmed. Close and check Pending/Completed Orders."
            );
            stopPolling();
            return;
          }
          if (status.status === "failed") {
            setStatusMessage("Payment failed. You can try again.");
            stopPolling();
            return;
          }
          if (status.status === "expired") {
            setStatusMessage("QR code expired. Generate a new one to continue.");
            stopPolling();
          }
        } catch {
          // Keep polling; transient network errors should not close the dialog.
        }
      }, 3000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start QR Ph checkout."
      );
      setOpen(true);
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || isStarting}
        onClick={handleStartCheckout}
      >
        <QrCode className="size-4" />
        {isStarting ? "Generating QR…" : "Pay with QR Ph (GCash, Maya, Bank Apps)"}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>QR Ph payment</DialogTitle>
            <DialogDescription>
              {customerName} · {formatCurrency(amount)}
              {paymentIntentId ? ` · ${paymentIntentId}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}

            {qrCodeUrl ? (
              <div className="flex flex-col items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- PayMongo returns a data URL / remote QR image */}
                <img
                  src={qrCodeUrl}
                  alt="PayMongo QR Ph code"
                  className="size-64 rounded-lg border bg-white object-contain p-2"
                />
                <p
                  className={
                    isPaid
                      ? "text-center text-sm font-medium text-emerald-700"
                      : "text-center text-sm text-muted-foreground"
                  }
                >
                  {statusMessage}
                </p>
                {!isPaid && (
                  <p className="text-center text-xs text-muted-foreground">
                    Checking payment status every 3 seconds. The order stays in
                    Pending until you tap Complete.
                  </p>
                )}
              </div>
            ) : (
              !error && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Preparing QR code…
                </p>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
