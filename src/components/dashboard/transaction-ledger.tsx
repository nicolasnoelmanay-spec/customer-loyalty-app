"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Coffee, History, Ticket, Trash2 } from "lucide-react";
import { formatTransactionDate } from "@/lib/format-date";
import { usePagination } from "@/hooks/use-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import { useLoyalty } from "@/hooks/use-loyalty";
import type { Transaction } from "@/types";

function TransactionBadge({ txn }: { txn: Transaction }) {
  if (txn.type === "earn") {
    return (
      <Badge
        variant="secondary"
        className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
      >
        <ArrowUpRight className="mr-1 size-3" />+{txn.points}
      </Badge>
    );
  }
  if (txn.type === "redeem") {
    return (
      <Badge
        variant="secondary"
        className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
      >
        <ArrowDownLeft className="mr-1 size-3" />-{txn.points}
      </Badge>
    );
  }
  if (txn.type === "voucher_earn") {
    return (
      <Badge
        variant="secondary"
        className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
      >
        <Ticket className="mr-1 size-3" />
        Voucher
      </Badge>
    );
  }
  if (txn.type === "free_drink_voucher_earn") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      >
        <Coffee className="mr-1 size-3" />
        Free drink
      </Badge>
    );
  }
  if (txn.type === "free_drink_voucher_redeem") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      >
        <Coffee className="mr-1 size-3" />
        Used
      </Badge>
    );
  }
  if (txn.type === "adjust") {
    const isIncrease = txn.points > 0;
    return (
      <Badge
        variant="secondary"
        className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
      >
        {isIncrease ? (
          <ArrowUpRight className="mr-1 size-3" />
        ) : (
          <ArrowDownLeft className="mr-1 size-3" />
        )}
        {isIncrease ? "+" : ""}
        {txn.points}
      </Badge>
    );
  }
  if (txn.type === "voucher_redeem") {
    return (
      <Badge
        variant="secondary"
        className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
      >
        <Ticket className="mr-1 size-3" />
        Used
      </Badge>
    );
  }
  return (
    <Badge
      variant="secondary"
      className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
    >
      <Ticket className="mr-1 size-3" />
      Used
    </Badge>
  );
}

export function TransactionLedger() {
  const {
    transactions,
    getCustomerById,
    clearTransactionHistory,
    deleteTransaction,
  } = useLoyalty();
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems,
  } = usePagination(transactions);

  async function handleClear() {
    await clearTransactionHistory();
    setConfirmClearOpen(false);
  }

  async function handleDeleteOne() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteTransaction(pendingDelete.id);
      setPendingDelete(null);
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete transaction."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="size-5 text-emerald-600" />
              Transaction History
            </CardTitle>
            <CardDescription>Recent point additions and redemptions</CardDescription>
          </div>
          {transactions.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-destructive hover:text-destructive"
              onClick={() => setConfirmClearOpen(true)}
            >
              <Trash2 className="size-4" />
              Clear
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Reason</TableHead>
                <TableHead className="text-right">Activity</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No transactions yet.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedItems.map((txn) => {
                  const customer = getCustomerById(txn.customerId);
                  return (
                    <TableRow key={txn.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTransactionDate(txn.createdAt)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {customer?.name ?? "Unknown"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell max-w-[240px] truncate text-muted-foreground">
                        {txn.reason}
                      </TableCell>
                      <TableCell className="text-right">
                        <TransactionBadge txn={txn} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          aria-label={`Delete transaction for ${customer?.name ?? "customer"}`}
                          onClick={() => {
                            setDeleteError(null);
                            setPendingDelete(txn);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <Dialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear transaction history?</DialogTitle>
            <DialogDescription>
              This will permanently remove all {transactions.length} transaction
              {transactions.length !== 1 ? "s" : ""} from the ledger. Customer point
              balances will not be changed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear}>
              Clear History
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this transaction?</DialogTitle>
            <DialogDescription>
              This removes the history entry
              {pendingDelete
                ? ` for ${getCustomerById(pendingDelete.customerId)?.name ?? "this customer"}`
                : ""}
              . Customer point balances will not be changed.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive">{deleteError}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={isDeleting}
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteOne}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
