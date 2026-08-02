"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequestPasswordReset } from "@/lib/api/customer-auth-client";

interface CustomerForgotPasswordFormProps {
  embedded?: boolean;
  onBackClick?: () => void;
}

export function CustomerForgotPasswordForm({
  embedded = false,
  onBackClick,
}: CustomerForgotPasswordFormProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiRequestPasswordReset(trimmedEmail);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          If an account exists for that email, a password reset link has been
          sent. Check your inbox and spam folder.
        </p>
        {embedded && onBackClick ? (
          <Button type="button" variant="outline" onClick={onBackClick}>
            Back to sign in
          </Button>
        ) : (
          <Button render={<Link href="/login?customer=1" />} variant="outline">
            Back to sign in
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
      <p className="text-sm text-muted-foreground">
        Enter the email on your member account and we&apos;ll send you a reset
        link.
      </p>
      <div className="space-y-2">
        <Label htmlFor="forgot-email">Email</Label>
        <Input
          id="forgot-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          disabled={isSubmitting}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending..." : "Send Reset Link"}
      </Button>
      {embedded && onBackClick ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={onBackClick}
          disabled={isSubmitting}
        >
          Back to sign in
        </Button>
      ) : (
        <Button
          render={<Link href="/login?customer=1" />}
          variant="ghost"
          className="w-full"
        >
          Back to sign in
        </Button>
      )}
    </form>
  );
}
