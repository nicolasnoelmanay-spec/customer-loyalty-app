"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loyaltyConfig } from "@/config/loyalty";
import { CustomerAccountDetails } from "@/components/customer/customer-account-details";
import { CustomerProfileForm } from "@/components/customer/customer-profile-form";
import { Button } from "@/components/ui/button";
import { useCustomerAuth } from "@/hooks/use-customer-auth";

export function CustomerAccountPage() {
  const router = useRouter();
  const { isReady, isAuthenticated, customer, transactions, logout, refreshAccount } =
    useCustomerAuth();

  useEffect(() => {
    if (isReady && !isAuthenticated) {
      router.replace("/login?customer=1");
    }
  }, [isReady, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      void refreshAccount();
    }
  }, [isAuthenticated, refreshAccount]);

  if (!isReady || !isAuthenticated || !customer) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Account</h1>
          <p className="text-sm text-muted-foreground">
            Your {loyaltyConfig.programName} details
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => logout().then(() => router.replace("/login?customer=1"))}
        >
          Sign Out
        </Button>
      </div>
      <CustomerProfileForm customer={customer} />
      <CustomerAccountDetails customer={customer} transactions={transactions} />
    </div>
  );
}
