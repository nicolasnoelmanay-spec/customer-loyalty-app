"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLoyalty } from "@/hooks/use-loyalty";
import type { Customer } from "@/types";

interface EditCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EditCustomerForm({
  customer,
  onOpenChange,
}: {
  customer: Customer;
  onOpenChange: (open: boolean) => void;
}) {
  const { updateCustomer } = useLoyalty();
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email);
  const [points, setPoints] = useState(String(customer.points));
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError("Name, phone, and email are required.");
      return;
    }
    const pointsNum = parseInt(points, 10);
    if (Number.isNaN(pointsNum) || pointsNum < 0) {
      setError("Points must be a non-negative whole number.");
      return;
    }
    try {
      await updateCustomer({
        customerId: customer.id,
        name,
        phone,
        email,
        points: pointsNum,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit Customer</DialogTitle>
        <DialogDescription>
          Update contact details and point balance for {customer.name}.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="edit-name">Full Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-phone">Phone Number</Label>
          <Input
            id="edit-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+63 917 123 4567"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@email.com"
          />
        </div>
        <div className="grid gap-2">
          <Label>Total Points Earned</Label>
          <Input
            value={customer.totalPointsEarned.toLocaleString()}
            readOnly
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            Lifetime total from coffee purchases. Not affected by redemptions or manual
            balance edits.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>50% Off Stack</Label>
            <Input
              value={String(customer.vouchersAvailable)}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
          <div className="grid gap-2">
            <Label>Free Drink Stack</Label>
            <Input
              value={String(customer.freeDrinkVouchersAvailable)}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Vouchers stack across streak cycles until redeemed. Lifetime earned:{" "}
          {customer.totalVouchersEarned} × 50% off,{" "}
          {customer.totalFreeDrinkVouchersEarned} × free drink.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="edit-points">Points Balance</Label>
          <Input
            id="edit-points"
            type="number"
            min="0"
            step="1"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-muted-foreground">
            Manual changes are logged in transaction history and do not affect
            streak milestones.
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
          Save Changes
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditCustomerDialog({
  customer,
  open,
  onOpenChange,
}: EditCustomerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {customer && (
          <EditCustomerForm
            key={`${customer.id}-${customer.points}`}
            customer={customer}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
