"use client";

import { useEffect, useState } from "react";
import { Pencil, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerAuth } from "@/hooks/use-customer-auth";
import { formatCurrency } from "@/lib/data/purchase-calculations";
import type { Customer } from "@/types";

interface CustomerProfileFormProps {
  customer: Customer;
}

export function CustomerProfileForm({ customer }: CustomerProfileFormProps) {
  const { updateProfile, totalVoucherSavings } = useCustomerAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [email, setEmail] = useState(customer.email);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!editing) {
      setName(customer.name);
      setPhone(customer.phone);
      setEmail(customer.email);
    }
  }, [customer, editing]);

  function handleCancel() {
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email);
    setError("");
    setSuccess("");
    setEditing(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !phone.trim() || !email.trim()) {
      setError("All fields are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateProfile({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
      });
      setSuccess("Profile updated.");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>Update your contact details.</CardDescription>
        </div>
        {!editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-2">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-phone">Phone Number</Label>
              <Input
                id="profile-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profile-email">Email</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Name:</span> {customer.name}
            </p>
            <p>
              <span className="text-muted-foreground">Phone:</span> {customer.phone}
            </p>
            <p>
              <span className="text-muted-foreground">Email:</span> {customer.email}
            </p>
            <p>
              <span className="text-muted-foreground">Username:</span> {customer.username}
            </p>
            <div className="rounded-lg border bg-indigo-50 px-3 py-3 dark:bg-indigo-950/40">
              <p className="flex items-center gap-2 font-medium text-indigo-800 dark:text-indigo-300">
                <Ticket className="size-4" />
                Total voucher savings
              </p>
              <p className="mt-1 text-lg font-semibold text-indigo-900 dark:text-indigo-200">
                {formatCurrency(totalVoucherSavings)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Lifetime savings from vouchers applied on completed orders.
              </p>
            </div>
            {success && (
              <p className="text-emerald-600 dark:text-emerald-400">{success}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
