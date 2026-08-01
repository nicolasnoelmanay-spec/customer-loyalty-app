"use client";

import { QrCode } from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
import { CustomerQrImage } from "@/components/qr/customer-qr-image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Customer } from "@/types";

interface CustomerQrDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerQrDialog({
  customer,
  open,
  onOpenChange,
}: CustomerQrDialogProps) {
  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-5" />
            Customer QR Code
          </DialogTitle>
          <DialogDescription>
            {customer.name} can show this code at the counter for quick check-in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          <CustomerQrImage
            customerId={customer.id}
            customerName={customer.name}
            size={280}
          />
          <p className="text-center text-sm text-muted-foreground">
            {loyaltyConfig.programName}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
