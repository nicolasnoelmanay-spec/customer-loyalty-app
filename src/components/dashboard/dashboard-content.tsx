"use client";

import { AddCustomerDialog } from "@/components/dashboard/add-customer-dialog";
import { CustomerDirectory } from "@/components/dashboard/customer-directory";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { LogPurchaseDialog } from "@/components/dashboard/log-purchase-dialog";
import { RedeemPointsDialog } from "@/components/dashboard/redeem-points-dialog";
import { ScanCustomerDialog } from "@/components/dashboard/scan-customer-dialog";
import { TransactionLedger } from "@/components/dashboard/transaction-ledger";
import { loyaltyConfig } from "@/config/loyalty";
import { useLoyalty } from "@/hooks/use-loyalty";

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
        <div className="flex flex-wrap gap-2">
          {isReady && (
            <>
              <AddCustomerDialog />
              <ScanCustomerDialog />
              <LogPurchaseDialog />
              <RedeemPointsDialog />
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
