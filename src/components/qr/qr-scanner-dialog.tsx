"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Camera, SwitchCamera } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parseCustomerQrPayload } from "@/lib/qr/customer-qr";

interface QrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (customerId: string) => void;
  title?: string;
  description?: string;
}

export function QrScannerDialog({
  open,
  onOpenChange,
  onScan,
  title = "Scan Customer QR Code",
  description = "Point the camera at the customer's loyalty QR code.",
}: QrScannerDialogProps) {
  const regionId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">(
    "environment"
  );

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Scanner may already be stopped when the dialog closes.
    }
  }, []);

  const handleDecoded = useCallback(
    (raw: string) => {
      if (handledRef.current) return;

      const customerId = parseCustomerQrPayload(raw);
      if (!customerId) {
        setError("Unrecognized QR code. Use a Coffeesentials customer card.");
        return;
      }

      handledRef.current = true;
      onScan(customerId);
      onOpenChange(false);
    },
    [onOpenChange, onScan]
  );

  useEffect(() => {
    if (!open) {
      handledRef.current = false;
      setError(null);
      void stopScanner();
      return;
    }

    let cancelled = false;

    async function startScanner() {
      setIsStarting(true);
      setError(null);
      handledRef.current = false;

      try {
        await stopScanner();
        if (cancelled) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.floor(
                Math.min(viewfinderWidth, viewfinderHeight) * 0.75
              );
              return { width: size, height: size };
            },
            aspectRatio: 1,
          },
          (decoded) => handleDecoded(decoded),
          () => {}
        );
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not access the camera. Check browser permissions."
          );
        }
      } finally {
        if (!cancelled) setIsStarting(false);
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [open, facingMode, regionId, handleDecoded, stopScanner]);

  function toggleCamera() {
    setFacingMode((current) =>
      current === "environment" ? "user" : "environment"
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-md max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="size-5" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border bg-black/5">
            <div id={regionId} className="min-h-[220px] w-full sm:min-h-[260px]" />
          </div>
          {isStarting && (
            <p className="text-sm text-muted-foreground text-center">
              Starting camera…
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <DialogFooter className="[&_button]:w-full sm:[&_button]:w-auto">
          <Button type="button" variant="outline" onClick={toggleCamera}>
            <SwitchCamera className="size-4" />
            Switch Camera
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
