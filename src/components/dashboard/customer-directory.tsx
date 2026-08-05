"use client";

import { useMemo, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, Mail, Pencil, QrCode, Search, Users } from "lucide-react";
import { EditCustomerDialog } from "@/components/dashboard/edit-customer-dialog";
import { SendCustomerEmailDialog } from "@/components/dashboard/send-customer-email-dialog";
import { CustomerQrDialog } from "@/components/qr/customer-qr-dialog";
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
import { ListPagination } from "@/components/ui/list-pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLoyalty } from "@/hooks/use-loyalty";
import { CUSTOMER_PAGE_SIZE, usePagination } from "@/hooks/use-pagination";
import { isNonMemberCustomer } from "@/lib/data/non-member";
import type { Customer } from "@/types";

type SortField =
  | "name"
  | "points"
  | "totalPointsEarned"
  | "consecutivePointsEarned"
  | "vouchersAvailable"
  | "freeDrinkVouchersAvailable"
  | "createdAt";

type SortDirection = "asc" | "desc";

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "points", label: "Balance" },
  { value: "totalPointsEarned", label: "Total earned" },
  { value: "consecutivePointsEarned", label: "Streak" },
  { value: "vouchersAvailable", label: "50% stack" },
  { value: "freeDrinkVouchersAvailable", label: "Free drink stack" },
  { value: "createdAt", label: "Date joined" },
];

function customerMatchesQuery(customer: Customer, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();
  const digits = query.replace(/\D/g, "");
  return (
    customer.name.toLowerCase().includes(normalized) ||
    customer.email.toLowerCase().includes(normalized) ||
    customer.username.toLowerCase().includes(normalized) ||
    customer.phone.toLowerCase().includes(normalized) ||
    (digits.length > 0 && customer.phone.replace(/\D/g, "").includes(digits))
  );
}

function compareCustomers(
  a: Customer,
  b: Customer,
  field: SortField,
  direction: SortDirection
): number {
  const factor = direction === "asc" ? 1 : -1;

  if (field === "name") {
    return a.name.localeCompare(b.name) * factor;
  }
  if (field === "createdAt") {
    return (
      (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
      factor
    );
  }

  return (a[field] - b[field]) * factor;
}

export function CustomerDirectory() {
  const { customers } = useLoyalty();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [qrCustomer, setQrCustomer] = useState<Customer | null>(null);
  const [emailCustomer, setEmailCustomer] = useState<Customer | null>(null);

  const directoryCustomers = useMemo(() => {
    const filtered = customers.filter(
      (customer) =>
        !isNonMemberCustomer(customer.id) &&
        customerMatchesQuery(customer, searchQuery.trim())
    );

    return [...filtered].sort((a, b) =>
      compareCustomers(a, b, sortField, sortDirection)
    );
  }, [customers, searchQuery, sortField, sortDirection]);

  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems,
  } = usePagination(
    directoryCustomers,
    CUSTOMER_PAGE_SIZE,
    `${searchQuery}|${sortField}|${sortDirection}|${directoryCustomers.length}`
  );

  const memberCount = customers.filter(
    (customer) => !isNonMemberCustomer(customer.id)
  ).length;

  return (
    <>
      <Card>
        <CardHeader className="gap-4 space-y-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-emerald-600" />
                Customer Directory
              </CardTitle>
              <CardDescription>
                {searchQuery.trim()
                  ? `${directoryCustomers.length} of ${memberCount} customer${memberCount !== 1 ? "s" : ""}`
                  : `${memberCount} registered customer${memberCount !== 1 ? "s" : ""}`}
              </CardDescription>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="space-y-2">
              <Label htmlFor="customer-directory-search" className="sr-only">
                Search customers
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="customer-directory-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, phone, email, or username"
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-directory-sort" className="sr-only">
                Sort by
              </Label>
              <Select
                value={sortField}
                onValueChange={(value) => {
                  if (value) setSortField(value as SortField);
                }}
              >
                <SelectTrigger id="customer-directory-sort" className="w-full sm:w-44">
                  <SelectValue>
                    {SORT_OPTIONS.find((option) => option.value === sortField)
                      ?.label ?? "Sort by"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      label={option.label}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="outline"
              className="sm:self-end"
              aria-label={
                sortDirection === "asc" ? "Sort ascending" : "Sort descending"
              }
              onClick={() =>
                setSortDirection((current) =>
                  current === "asc" ? "desc" : "asc"
                )
              }
            >
              {sortDirection === "asc" ? (
                <ArrowUpAZ className="size-4" />
              ) : (
                <ArrowDownAZ className="size-4" />
              )}
              {sortDirection === "asc" ? "Asc" : "Desc"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Phone</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">
                    Total Earned
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    Streak
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    50% Stack
                  </TableHead>
                  <TableHead className="hidden lg:table-cell text-right">
                    Free Drink Stack
                  </TableHead>
                  <TableHead className="w-32">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberCount === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No customers yet. Add your first customer to get started.
                    </TableCell>
                  </TableRow>
                ) : directoryCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No customers match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">
                        {customer.name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {customer.phone}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {customer.email}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="secondary"
                          className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                        >
                          {customer.points.toLocaleString()} pts
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-right">
                        <span className="text-muted-foreground">
                          {customer.totalPointsEarned.toLocaleString()} pts
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-muted-foreground">
                        {customer.consecutivePointsEarned}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        <Badge
                          variant="secondary"
                          className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                        >
                          {customer.vouchersAvailable}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-right">
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                        >
                          {customer.freeDrinkVouchersAvailable}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Show QR code for ${customer.name}`}
                            onClick={() => setQrCustomer(customer)}
                          >
                            <QrCode className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Send email to ${customer.name}`}
                            onClick={() => setEmailCustomer(customer)}
                          >
                            <Mail className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Edit ${customer.name}`}
                            onClick={() => setEditingCustomer(customer)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <ListPagination
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <EditCustomerDialog
        customer={editingCustomer}
        open={editingCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCustomer(null);
        }}
      />

      <CustomerQrDialog
        customer={qrCustomer}
        open={qrCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setQrCustomer(null);
        }}
      />

      <SendCustomerEmailDialog
        customer={emailCustomer}
        open={emailCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setEmailCustomer(null);
        }}
      />
    </>
  );
}
