"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

interface CustomerLoginFormProps {
  embedded?: boolean;
  onJoinClick?: () => void;
  onForgotClick?: () => void;
}

export function CustomerLoginForm({
  embedded = false,
  onJoinClick,
  onForgotClick,
}: CustomerLoginFormProps) {
  const router = useRouter();
  const { login } = useCustomerAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password) {
      setError("Enter your username, email, or phone and password.");
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await login(username.trim(), password);
      if (success) {
        router.replace("/customer");
      } else {
        setError("Invalid login credentials.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={embedded ? "space-y-4" : undefined}>
      <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
        <div className="space-y-2">
          <Label htmlFor="customer-username">Username, Email, or Phone</Label>
          <Input
            id="customer-username"
            name="customer-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="customer-password">Password</Label>
            {embedded && onForgotClick ? (
              <button
                type="button"
                onClick={onForgotClick}
                className="text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                Forgot password?
              </button>
            ) : (
              <Link
                href="/login?customer=1&forgot=1"
                className="text-xs font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                Forgot password?
              </Link>
            )}
          </div>
          <Input
            id="customer-password"
            name="customer-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground">
              Not a member yet?{" "}
              {embedded && onJoinClick ? (
                <button
                  type="button"
                  onClick={onJoinClick}
                  className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                >
                  Register here
                </button>
              ) : (
                <Link
                  href="/login?join=1"
                  className="font-medium text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
                >
                  Register here
                </Link>
              )}
              .
            </p>
          </div>
        )}
        <Button
          type="submit"
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isSubmitting}
        >
          <LogIn className="size-4" />
          {isSubmitting ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </div>
  );
}
