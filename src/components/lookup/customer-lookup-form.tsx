"use client";

import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Coffee,
  QrCode,
  Search,
  Sparkles,
  Ticket,
} from "lucide-react";
import { formatTransactionDate } from "@/lib/format-date";
import { formatStreakProgress, loyaltyConfig } from "@/config/loyalty";
import { usePagination } from "@/hooks/use-pagination";
import { lookupCustomer } from "@/lib/api/loyalty-client";
import { CustomerQrImage } from "@/components/qr/customer-qr-image";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListPagination } from "@/components/ui/list-pagination";
import type { Customer, Transaction } from "@/types";

export function CustomerLookupForm() {
  const [query, setQuery] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems,
  } = usePagination(transactions, 10, customer?.id);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setNotFound(false);
    try {
      const result = await lookupCustomer(query);
      setCustomer(result.customer);
      setTransactions(result.transactions);
      setNotFound(!result.customer);
    } catch {
      setCustomer(null);
      setTransactions([]);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <Sparkles className="size-6 text-emerald-600" />
          </div>
          <CardTitle>Customer Lookup</CardTitle>
          <CardDescription>
            Search by phone or email to view a member&apos;s points and recent
            activity.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lookup">Phone or Email</Label>
              <Input
                id="lookup"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setNotFound(false);
                }}
                placeholder="nicolas.manay@email.com or +63 917 123 4567"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Search className="size-4" />
              {loading ? "Searching..." : "Look Up Points"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {notFound && (
        <Card className="border-destructive/50">
          <CardContent className="py-6 text-center text-muted-foreground">
            No account found with that phone or email. Please check your details
            or ask staff to register you.
          </CardContent>
        </Card>
      )}

      {customer && (
        <>
          <Card className="border-emerald-200 dark:border-emerald-900">
            <CardHeader className="text-center pb-2">
              <CardDescription>Welcome back,</CardDescription>
              <CardTitle className="text-2xl">{customer.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-center pb-6">
              <p className="text-sm text-muted-foreground mb-1">Your balance</p>
              <p className="text-5xl font-bold text-emerald-600 dark:text-emerald-400">
                {customer.points.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground mt-1">reward points</p>
              <p className="text-sm text-muted-foreground mt-2">
                {customer.totalPointsEarned.toLocaleString()} total points earned
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <p className="text-indigo-600 dark:text-indigo-400">
                  {customer.vouchersAvailable} × {loyaltyConfig.voucher.label}
                  {customer.vouchersAvailable !== 1 ? "s" : ""} in stack
                </p>
                <p className="text-amber-600 dark:text-amber-400">
                  {customer.freeDrinkVouchersAvailable} ×{" "}
                  {loyaltyConfig.freeDrinkVoucher.label}
                  {customer.freeDrinkVouchersAvailable !== 1 ? "s" : ""} in stack
                </p>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Streak: {formatStreakProgress(customer.consecutivePointsEarned)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="text-center">
              <CardTitle className="flex items-center justify-center gap-2 text-base">
                <QrCode className="size-5" />
                Your Loyalty QR Code
              </CardTitle>
              <CardDescription>
                Show this at the counter so staff can scan you in quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pb-6">
              <CustomerQrImage
                customerId={customer.id}
                customerName={customer.name}
                size={220}
                showDownload
              />
            </CardContent>
          </Card>

          {transactions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="hidden sm:table-cell">Details</TableHead>
                      <TableHead className="text-right">Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatTransactionDate(txn.createdAt)}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell max-w-[200px] truncate text-muted-foreground">
                            {txn.reason}
                          </TableCell>
                          <TableCell className="text-right">
                            {txn.type === "earn" && (
                              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                <ArrowUpRight className="mr-1 size-3" />+{txn.points}
                              </Badge>
                            )}
                            {txn.type === "redeem" && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                                <ArrowDownLeft className="mr-1 size-3" />-{txn.points}
                              </Badge>
                            )}
                            {txn.type === "voucher_earn" && (
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                <Ticket className="mr-1 size-3" />Voucher
                              </Badge>
                            )}
                            {txn.type === "voucher_redeem" && (
                              <Badge variant="secondary" className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                <Ticket className="mr-1 size-3" />Used
                              </Badge>
                            )}
                            {txn.type === "free_drink_voucher_earn" && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Coffee className="mr-1 size-3" />Free drink
                              </Badge>
                            )}
                            {txn.type === "free_drink_voucher_redeem" && (
                              <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                <Coffee className="mr-1 size-3" />Used
                              </Badge>
                            )}
                            {txn.type === "adjust" && (
                              <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                                {txn.points > 0 ? (
                                  <ArrowUpRight className="mr-1 size-3" />
                                ) : (
                                  <ArrowDownLeft className="mr-1 size-3" />
                                )}
                                {txn.points > 0 ? "+" : ""}
                                {txn.points}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
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
          )}
        </>
      )}
    </div>
  );
}
