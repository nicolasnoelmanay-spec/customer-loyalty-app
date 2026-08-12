import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/types";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  ingredients: "Ingredients",
  supplies: "Supplies",
  utilities: "Utilities",
  rent: "Rent",
  payroll: "Payroll",
  maintenance: "Maintenance",
  other: "Other",
};

const categorySet = new Set<string>(EXPENSE_CATEGORIES);

export function isValidExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && categorySet.has(value);
}

export function formatExpenseCategoryLabel(category: ExpenseCategory): string {
  return EXPENSE_CATEGORY_LABELS[category];
}
