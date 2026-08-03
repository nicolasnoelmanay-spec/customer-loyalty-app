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
import {
  NON_MEMBER_CUSTOMER_ID,
  isNonMemberCustomer,
} from "@/lib/data/non-member";

interface CustomerSelectFieldProps {
  customerId: string;
  customers: Customer[];
  onCustomerIdChange: (customerId: string) => void;
  onScanError?: (message: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function CustomerSelectField({
  customerId,
  customers,
  onCustomerIdChange,
  onScanError,
  label = "Customer",
  placeholder = "Select customer...",
  disabled = false,
}: CustomerSelectFieldProps) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const sortedCustomers = [...customers].sort((a, b) => {
    if (a.id === NON_MEMBER_CUSTOMER_ID) return -1;
    if (b.id === NON_MEMBER_CUSTOMER_ID) return 1;
    return a.name.localeCompare(b.name);
  });
  const selectedCustomer = sortedCustomers.find((c) => c.id === customerId);

  function handleScan(scannedId: string) {
    if (disabled) return;
    const match = customers.find((c) => c.id === scannedId);
    if (!match) {
      onScanError?.("Customer not found. Add them to the directory first.");
      return;
    }
    onCustomerIdChange(scannedId);
  }

  function customerLabel(customer: Customer) {
    if (isNonMemberCustomer(customer.id)) {
      return `${customer.name} (non-member)`;
    }
    return `${customer.name} (${customer.points} pts)`;
  }

  return (
    <>
      <div className="grid gap-2">
        <Label>{label}</Label>
        <div className="flex gap-2">
          <Select
            value={customerId}
            onValueChange={(value) => onCustomerIdChange(value ?? "")}
            disabled={disabled}
          >
            <SelectTrigger className="w-full flex-1">
              <SelectValue placeholder={placeholder}>
                {selectedCustomer
                  ? isNonMemberCustomer(selectedCustomer.id)
                    ? `${selectedCustomer.name} (non-member)`
                    : selectedCustomer.name
                  : undefined}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {sortedCustomers.map((customer) => (
                <SelectItem
                  key={customer.id}
                  value={customer.id}
                  label={customerLabel(customer)}
                >
                  {customerLabel(customer)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Scan customer QR code"
            disabled={disabled}
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
