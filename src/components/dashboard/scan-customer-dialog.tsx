"use client";

import { useEffect, useState } from "react";
import { ScanLine } from "lucide-react";
import { QrScannerDialog } from "@/components/qr/qr-scanner-dialog";
import { CustomerQrDialog } from "@/components/qr/customer-qr-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLoyalty } from "@/hooks/use-loyalty";
import type { Customer } from "@/types";

export function ScanCustomerDialog() {
  const { customers, getCustomerById } = useLoyalty();
  const [open, setOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [foundCustomer, setFoundCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const foundCustomerId = foundCustomer?.id;

  useEffect(() => {
    if (!foundCustomerId) return;
    const updated = getCustomerById(foundCustomerId);
    if (updated) setFoundCustomer(updated);
  }, [customers, foundCustomerId, getCustomerById]);

  function reset() {
    setFoundCustomer(null);
    setError(null);
  }

  function handleScan(customerId: string) {
    const customer = getCustomerById(customerId);
    if (!customer) {
      setError("Customer not found in the directory.");
      return;
    }
    setFoundCustomer(customer);
    setError(null);
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogTrigger render={<Button size="sm" variant="outline" />}>
          <ScanLine className="size-4" />
          Scan QR
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Scan Customer</DialogTitle>
            <DialogDescription>
              Scan a customer&apos;s loyalty QR code to look them up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Button
              type="button"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => setScannerOpen(true)}
            >
              <ScanLine className="size-4" />
              Open Camera Scanner
            </Button>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {foundCustomer && (
              <>
                <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                  <div>
                    <p className="font-medium text-lg">{foundCustomer.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {foundCustomer.phone} · {foundCustomer.email}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {foundCustomer.points.toLocaleString()} pts
                    </Badge>
                    <Badge variant="secondary">
                      {foundCustomer.vouchersAvailable} × 50% off
                    </Badge>
                    <Badge variant="secondary">
                      {foundCustomer.freeDrinkVouchersAvailable} × free drink
                    </Badge>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => setQrOpen(true)}
                  >
                    View Customer QR
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />

      <CustomerQrDialog
        customer={foundCustomer}
        open={qrOpen}
        onOpenChange={setQrOpen}
      />
    </>
  );
}
