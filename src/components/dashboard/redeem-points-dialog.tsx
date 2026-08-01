"use client";

import { useState } from "react";
import { Gift } from "lucide-react";
import { RedeemCustomerForm } from "@/components/dashboard/redeem-customer-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RedeemPointsDialog() {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");

  function reset() {
    setCustomerId("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) reset();
      }}
    >
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Gift className="size-4" />
        Redeem
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Redeem Reward</DialogTitle>
          <DialogDescription>
            Vouchers stack across streak cycles. Redeeming vouchers does not affect
            points balance or streak.
          </DialogDescription>
        </DialogHeader>
        <RedeemCustomerForm
          customerId={customerId}
          onCustomerIdChange={setCustomerId}
          onSuccess={() => {
            reset();
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
