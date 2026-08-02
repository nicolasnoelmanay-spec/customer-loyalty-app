"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, UserPlus } from "lucide-react";
import { loyaltyConfig } from "@/config/loyalty";
import { apiRegisterMember } from "@/lib/api/loyalty-client";
import { CustomerQrImage } from "@/components/qr/customer-qr-image";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Customer } from "@/types";

interface MemberRegistrationFormProps {
  embedded?: boolean;
  onLoginClick?: () => void;
}

export function MemberRegistrationForm({
  embedded = false,
  onLoginClick,
}: MemberRegistrationFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registeredCustomer, setRegisteredCustomer] = useState<Customer | null>(
    null
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (
      !name.trim() ||
      !phone.trim() ||
      !email.trim() ||
      !username.trim() ||
      !password
    ) {
      setError("All fields are required.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const customer = await apiRegisterMember({
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        username: username.trim(),
        password,
      });
      setRegisteredCustomer(customer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleRegisterAnother() {
    setRegisteredCustomer(null);
    setName("");
    setPhone("");
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setError("");
  }

  if (registeredCustomer) {
    return (
      <div className="space-y-6 py-2">
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <CheckCircle2 className="size-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold">Welcome, {registeredCustomer.name}!</h2>
          <p className="text-sm text-muted-foreground">
            You&apos;re now a member of {loyaltyConfig.programName}. A welcome
            email was sent to {registeredCustomer.email}. Sign in with your
            username and password to view your account, or show your QR code at
            the counter to earn points.
          </p>
        </div>
        <CustomerQrImage
          customerId={registeredCustomer.id}
          customerName={registeredCustomer.name}
          size={220}
          showDownload
        />
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1">
          <p>
            <span className="text-muted-foreground">Username:</span>{" "}
            {registeredCustomer.username}
          </p>
          <p>
            <span className="text-muted-foreground">Phone:</span>{" "}
            {registeredCustomer.phone}
          </p>
          <p>
            <span className="text-muted-foreground">Email:</span>{" "}
            {registeredCustomer.email}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={handleRegisterAnother}
          >
            Register Another
          </Button>
          {embedded && onLoginClick ? (
            <Button
              type="button"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={onLoginClick}
            >
              Sign In
            </Button>
          ) : (
            <Link
              href="/login?customer=1"
              className={cn(
                buttonVariants({
                  className: "flex-1 bg-emerald-600 hover:bg-emerald-700 text-white",
                })
              )}
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-4 py-2" : "mx-auto w-full max-w-lg space-y-6"}>
      {!embedded && (
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <UserPlus className="size-6 text-emerald-600" />
          </div>
          <h2 className="text-lg font-semibold">Become a Member</h2>
          <p className="text-sm text-muted-foreground">
            Join {loyaltyConfig.programName} to earn points on coffee drinks and
            unlock vouchers.
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div className="space-y-2">
          <Label htmlFor="member-name">Full Name</Label>
          <Input
            id="member-name"
            name="member-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-phone">Phone Number</Label>
          <Input
            id="member-phone"
            name="member-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-email">Email</Label>
          <Input
            id="member-email"
            name="member-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-username">Username</Label>
          <Input
            id="member-username"
            name="member-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-password">Password</Label>
          <Input
            id="member-password"
            name="member-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="member-confirm-password">Confirm Password</Label>
          <Input
            id="member-confirm-password"
            name="member-confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            {(error.includes("already registered") ||
              error.includes("already taken")) && (
              <p className="text-sm text-muted-foreground">
                Already a member?{" "}
                {embedded && onLoginClick ? (
                  <button
                    type="button"
                    onClick={onLoginClick}
                    className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                  >
                    Sign in
                  </button>
                ) : (
                  <Link
                    href="/login?customer=1"
                    className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                  >
                    Sign in
                  </Link>
                )}
                .
              </p>
            )}
          </div>
        )}
        <Button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Registering..." : "Register"}
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Already a member?{" "}
        {embedded && onLoginClick ? (
          <button
            type="button"
            onClick={onLoginClick}
            className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
          >
            Sign in
          </button>
        ) : (
          <Link
            href="/login?customer=1"
            className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
          >
            Sign in
          </Link>
        )}
        .
      </p>
    </div>
  );
}
