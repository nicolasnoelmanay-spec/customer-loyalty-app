"use client";

import { useState } from "react";
import { Pencil, Users } from "lucide-react";
import { EditCustomerDialog } from "@/components/dashboard/edit-customer-dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLoyalty } from "@/hooks/use-loyalty";
import type { Customer } from "@/types";

export function CustomerDirectory() {
  const { customers } = useLoyalty();
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5 text-emerald-600" />
            Customer Directory
          </CardTitle>
          <CardDescription>
            {customers.length} registered customer{customers.length !== 1 ? "s" : ""}
          </CardDescription>
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
                  <TableHead className="hidden xl:table-cell text-right">Total Earned</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Streak</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">50% Stack</TableHead>
                  <TableHead className="hidden lg:table-cell text-right">Free Drink Stack</TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No customers yet. Add your first customer to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
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
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${customer.name}`}
                          onClick={() => setEditingCustomer(customer)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <EditCustomerDialog
        customer={editingCustomer}
        open={editingCustomer !== null}
        onOpenChange={(open) => {
          if (!open) setEditingCustomer(null);
        }}
      />
    </>
  );
}
