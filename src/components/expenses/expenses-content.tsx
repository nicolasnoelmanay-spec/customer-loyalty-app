"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EXPENSE_PAGE_SIZE, usePagination } from "@/hooks/use-pagination";
import {
  apiCreateExpense,
  apiDeleteExpense,
  apiUpdateExpense,
  fetchExpenses,
} from "@/lib/api/loyalty-client";
import {
  COMPLETED_ORDER_PERIODS,
  formatYmdForDateInput,
  formatYmdForMonthInput,
  getCompletedOrderPeriodLabel,
  getCompletedOrderPeriodRangeLabel,
  getManilaTodayYmd,
  isCompletedOrderInPeriod,
  isCurrentPeriodSelection,
  toManilaYmd,
  ymdToReferenceDate,
  type CompletedOrderPeriod,
  type ManilaYmd,
} from "@/lib/completed-order-period";
import { formatCurrency } from "@/lib/data/purchase-calculations";
import { formatPaymentTypeLabel } from "@/lib/data/pending-order-utils";
import {
  EXPENSE_CATEGORY_LABELS,
  formatExpenseCategoryLabel,
} from "@/lib/expense-categories";
import { formatExpenseDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
  type PaymentType,
} from "@/types";

function dateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 4, 0, 0)).toISOString();
}

function computeExpenseStats(expenses: Expense[]) {
  let total = 0;
  let cashTotal = 0;
  let gcashTotal = 0;

  for (const expense of expenses) {
    total += expense.amount;
    if (expense.paymentType === "gcash") {
      gcashTotal += expense.amount;
    } else {
      cashTotal += expense.amount;
    }
  }

  return {
    count: expenses.length,
    total,
    cashTotal,
    gcashTotal,
  };
}

interface ExpenseFormState {
  description: string;
  amount: string;
  category: ExpenseCategory;
  paymentType: PaymentType;
  incurredOn: string;
  notes: string;
}

function emptyFormState(): ExpenseFormState {
  return {
    description: "",
    amount: "",
    category: "supplies",
    paymentType: "cash",
    incurredOn: formatYmdForDateInput(getManilaTodayYmd()),
    notes: "",
  };
}

function formStateFromExpense(expense: Expense): ExpenseFormState {
  return {
    description: expense.description,
    amount: String(expense.amount),
    category: expense.category,
    paymentType: expense.paymentType,
    incurredOn: formatYmdForDateInput(toManilaYmd(expense.incurredAt)),
    notes: expense.notes,
  };
}

export function ExpensesContent() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<CompletedOrderPeriod>("monthly");
  const [referenceYmd, setReferenceYmd] = useState<ManilaYmd>(() =>
    getManilaTodayYmd()
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseFormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Expense | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const referenceDate = useMemo(
    () => ymdToReferenceDate(referenceYmd),
    [referenceYmd]
  );

  const loadExpenses = useCallback(async () => {
    const loaded = await fetchExpenses();
    setExpenses(loaded);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchExpenses()
      .then((loaded) => {
        if (!cancelled) setExpenses(loaded);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load expenses.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function resetToCurrentPeriod() {
    setReferenceYmd(getManilaTodayYmd());
  }

  function handleDateInputChange(value: string) {
    if (!value) return;
    const [year, month, day] = value.split("-").map(Number);
    setReferenceYmd({ year, month, day });
  }

  function handleMonthInputChange(value: string) {
    if (!value) return;
    const [year, month] = value.split("-").map(Number);
    setReferenceYmd({ year, month, day: 1 });
  }

  function handleYearInputChange(value: string) {
    const year = Number(value);
    if (!Number.isInteger(year) || year < 2000) return;
    setReferenceYmd({ year, month: 1, day: 1 });
  }

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) =>
        isCompletedOrderInPeriod(expense.incurredAt, period, referenceDate)
      ),
    [expenses, period, referenceDate]
  );

  const stats = useMemo(
    () => computeExpenseStats(filteredExpenses),
    [filteredExpenses]
  );
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    pageSize,
    totalItems,
  } = usePagination(
    filteredExpenses,
    EXPENSE_PAGE_SIZE,
    `${period}-${referenceYmd.year}-${referenceYmd.month}-${referenceYmd.day}`
  );
  const periodRangeLabel = useMemo(
    () => getCompletedOrderPeriodRangeLabel(period, referenceDate),
    [period, referenceDate]
  );
  const periodLabel = useMemo(
    () => getCompletedOrderPeriodLabel(period, referenceYmd),
    [period, referenceYmd]
  );
  const isCurrentSelection = useMemo(
    () => isCurrentPeriodSelection(period, referenceYmd),
    [period, referenceYmd]
  );
  const earliestExpenseYear = useMemo(() => {
    if (expenses.length === 0) return referenceYmd.year;
    return Math.min(
      ...expenses.map((expense) => toManilaYmd(expense.incurredAt).year)
    );
  }, [expenses, referenceYmd.year]);

  function openAddDialog() {
    setEditingExpense(null);
    setForm(emptyFormState());
    setFormError(null);
    setFormOpen(true);
  }

  function openEditDialog(expense: Expense) {
    setEditingExpense(expense);
    setForm(formStateFromExpense(expense));
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingExpense(null);
    setFormError(null);
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.description.trim()) {
      setFormError("Description is required.");
      return;
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      setFormError("Amount must be a whole peso amount greater than 0.");
      return;
    }
    if (!form.incurredOn) {
      setFormError("Expense date is required.");
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      const payload = {
        description: form.description.trim(),
        amount,
        category: form.category,
        paymentType: form.paymentType,
        notes: form.notes.trim(),
        incurredAt: dateInputToIso(form.incurredOn),
      };
      if (editingExpense) {
        await apiUpdateExpense(editingExpense.id, payload);
      } else {
        await apiCreateExpense(payload);
      }
      await loadExpenses();
      closeForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save expense.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await apiDeleteExpense(pendingDelete.id);
      setPendingDelete(null);
      await loadExpenses();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete expense."
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Expense Tracking</h1>
          <p className="text-muted-foreground">
            Log shop expenses and review totals by day, week, month, or year.
          </p>
        </div>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={openAddDialog}
        >
          <Plus className="size-4" />
          Add Expense
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Loading expenses…
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <Tabs
              value={period}
              onValueChange={(value) => setPeriod(value as CompletedOrderPeriod)}
            >
              <TabsList className="grid w-full grid-cols-4 sm:w-auto sm:inline-grid">
                {COMPLETED_ORDER_PERIODS.map((option) => (
                  <TabsTrigger key={option.value} value={option.value}>
                    {option.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              {(period === "daily" || period === "weekly") && (
                <div className="space-y-2">
                  <Label htmlFor="expenses-date">
                    {period === "daily" ? "Select day" : "Select week"}
                  </Label>
                  <Input
                    id="expenses-date"
                    type="date"
                    value={formatYmdForDateInput(referenceYmd)}
                    onChange={(e) => handleDateInputChange(e.target.value)}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
              {period === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="expenses-month">Select month</Label>
                  <Input
                    id="expenses-month"
                    type="month"
                    value={formatYmdForMonthInput(referenceYmd)}
                    onChange={(e) => handleMonthInputChange(e.target.value)}
                    className="w-full sm:w-auto"
                  />
                </div>
              )}
              {period === "yearly" && (
                <div className="space-y-2">
                  <Label htmlFor="expenses-year">Select year</Label>
                  <Input
                    id="expenses-year"
                    type="number"
                    min={earliestExpenseYear}
                    max={getManilaTodayYmd().year + 1}
                    value={referenceYmd.year}
                    onChange={(e) => handleYearInputChange(e.target.value)}
                    className="w-full sm:w-[120px]"
                  />
                </div>
              )}
              {!isCurrentSelection && (
                <Button type="button" variant="outline" onClick={resetToCurrentPeriod}>
                  Current period
                </Button>
              )}
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Showing results for {periodLabel} · {periodRangeLabel}
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Receipt className="size-4" />
                  Expenses
                </CardDescription>
                <CardTitle className="text-3xl">{stats.count}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Logged {periodLabel}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Wallet className="size-4" />
                  Total Spent
                </CardDescription>
                <CardTitle className="text-3xl">
                  {formatCurrency(stats.total)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(stats.cashTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">GCash</p>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(stats.gcashTotal)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Average</CardDescription>
                <CardTitle className="text-3xl">
                  {formatCurrency(
                    stats.count > 0 ? Math.round(stats.total / stats.count) : 0
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Per expense {periodLabel}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense log</CardTitle>
              <CardDescription>
                {stats.count} expense{stats.count !== 1 ? "s" : ""} {periodLabel} ·{" "}
                {formatCurrency(stats.total)} total (Cash{" "}
                {formatCurrency(stats.cashTotal)}, GCash{" "}
                {formatCurrency(stats.gcashTotal)})
                {totalItems > EXPENSE_PAGE_SIZE
                  ? ` · ${EXPENSE_PAGE_SIZE} per page`
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {filteredExpenses.length === 0 ? (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  {expenses.length === 0
                    ? "No expenses yet. Add the first shop expense to start tracking."
                    : `No expenses ${periodLabel}.`}
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="hidden sm:table-cell">
                            Category
                          </TableHead>
                          <TableHead className="hidden md:table-cell">
                            Payment
                          </TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="w-24">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedItems.map((expense) => (
                          <TableRow key={expense.id}>
                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {formatExpenseDate(expense.incurredAt)}
                            </TableCell>
                            <TableCell>
                              <p className="font-medium">{expense.description}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">
                                {formatExpenseCategoryLabel(expense.category)} ·{" "}
                                {formatPaymentTypeLabel(expense.paymentType)}
                              </p>
                              {expense.notes ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {expense.notes}
                                </p>
                              ) : null}
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <Badge variant="secondary">
                                {formatExpenseCategoryLabel(expense.category)}
                              </Badge>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-muted-foreground">
                              {formatPaymentTypeLabel(expense.paymentType)}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(expense.amount)}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Edit ${expense.description}`}
                                  onClick={() => openEditDialog(expense)}
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Delete ${expense.description}`}
                                  onClick={() => {
                                    setDeleteError(null);
                                    setPendingDelete(expense);
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Edit expense" : "Add expense"}
              </DialogTitle>
              <DialogDescription>
                Record a shop cost. Amounts are in whole pesos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="expense-description">Description</Label>
                <Input
                  id="expense-description"
                  value={form.description}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Coffee beans, electricity, rent"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-amount">Amount (₱)</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="1"
                  step="1"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      amount: e.target.value,
                    }))
                  }
                  placeholder="500"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => {
                    if (!value) return;
                    setForm((current) => ({
                      ...current,
                      category: value as ExpenseCategory,
                    }));
                  }}
                >
                  <SelectTrigger id="expense-category" className="w-full">
                    <SelectValue>
                      {EXPENSE_CATEGORY_LABELS[form.category]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                        label={EXPENSE_CATEGORY_LABELS[category]}
                      >
                        {EXPENSE_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-date">Date</Label>
                <Input
                  id="expense-date"
                  type="date"
                  value={form.incurredOn}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      incurredOn: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Payment type</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        paymentType: "cash",
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      form.paymentType === "cash"
                        ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        paymentType: "gcash",
                      }))
                    }
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      form.paymentType === "gcash"
                        ? "border-sky-600 bg-sky-50 dark:bg-sky-950/40"
                        : "border-border hover:bg-muted/50"
                    )}
                  >
                    GCash
                  </button>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-notes">Notes (optional)</Label>
                <Textarea
                  id="expense-notes"
                  value={form.notes}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Vendor, invoice number, or other details"
                  rows={2}
                />
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isSaving
                  ? "Saving…"
                  : editingExpense
                    ? "Save changes"
                    : "Add expense"}
              </Button>
            </DialogFooter>
          </form>
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
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>
              {pendingDelete
                ? `${pendingDelete.description} · ${formatCurrency(pendingDelete.amount)} will be removed.`
                : "This expense will be removed."}
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingDelete(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
