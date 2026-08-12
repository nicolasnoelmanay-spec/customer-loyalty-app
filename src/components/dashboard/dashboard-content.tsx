"use client";

import Link from "next/link";
import { Receipt, Scale } from "lucide-react";
import { AddCustomerDialog } from "@/components/dashboard/add-customer-dialog";
import { CustomerDirectory } from "@/components/dashboard/customer-directory";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LogPurchaseDialog } from "@/components/dashboard/log-purchase-dialog";
import { RedeemPointsDialog } from "@/components/dashboard/redeem-points-dialog";
import { RegistrationQrDialog } from "@/components/dashboard/registration-qr-dialog";
import { ScanCustomerDialog } from "@/components/dashboard/scan-customer-dialog";
import { TransactionLedger } from "@/components/dashboard/transaction-ledger";
import { loyaltyConfig } from "@/config/loyalty";
import { useLoyalty } from "@/hooks/use-loyalty";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function DashboardContent() {
  const { isReady } = useLoyalty();

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Dashboard</h1>
          <p className="text-muted-foreground">
            Manage customers and loyalty points for {loyaltyConfig.programName}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap [&_button]:w-full sm:[&_button]:w-auto [&_a]:w-full sm:[&_a]:w-auto">
          {isReady && (
            <>
              <AddCustomerDialog />
              <RegistrationQrDialog />
              <ScanCustomerDialog />
              <LogPurchaseDialog />
              <RedeemPointsDialog />
              <Link
                href="/expenses"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Receipt className="size-4" />
                Expenses
              </Link>
              <Link
                href="/summary"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                <Scale className="size-4" />
                Summary
              </Link>
            </>
          )}
        </div>
      </div>

      {!isReady ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-6">
          <CustomerDirectory />
          <TransactionLedger />
        </div>
      )}
    </>
  );
}
