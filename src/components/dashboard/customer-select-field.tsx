"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import { QrScannerDialog } from "@/components/qr/qr-scanner-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Customer } from "@/types";

interface CustomerSelectFieldProps {
  customerId: string;
  customers: Customer[];
  onCustomerIdChange: (customerId: string) => void;
  onScanError?: (message: string) => void;
  label?: string;
  placeholder?: string;
}

export function CustomerSelectField({
  customerId,
  customers,
  onCustomerIdChange,
  onScanError,
  label = "Customer",
  placeholder = "Select customer...",
}: CustomerSelectFieldProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function handleScan(scannedId: string) {
    const match = customers.find((c) => c.id === scannedId);
    if (!match) {
      onScanError?.("Customer not found. Add them to the directory first.");
      return;
    }
    onCustomerIdChange(scannedId);
  }

  return (
    <>
      <div className="grid gap-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Select
            value={customerId}
            onValueChange={(value) => onCustomerIdChange(value ?? "")}
          >
            <SelectTrigger className="w-full flex-1">
              <SelectValue placeholder={placeholder}>
                {selectedCustomer?.name}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id} label={customer.name}>
                  {customer.name} ({customer.points} pts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Scan customer QR code"
            onClick={() => setScannerOpen(true)}
          >
            <ScanLine className="size-4" />
          </Button>
        </div>
      </div>

      <QrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        onScan={handleScan}
      />
    </>
  );
}
