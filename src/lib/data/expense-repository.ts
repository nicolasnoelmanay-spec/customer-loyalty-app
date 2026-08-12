import { getSql } from "@/lib/db";
import { isValidExpenseCategory } from "@/lib/expense-categories";
import { generateId } from "@/lib/data/loyalty-calculations";
import { normalizePaymentType } from "@/lib/data/pending-order-utils";
import type {
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  PaymentType,
  UpdateExpenseInput,
} from "@/types";

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  category: string;
  payment_type: string;
  notes: string;
  incurred_at: Date | string;
  created_at: Date | string;
}

let expensesTableReady: Promise<void> | null = null;

async function ensureExpensesTable(): Promise<void> {
  if (!expensesTableReady) {
    expensesTableReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS expenses (
          id TEXT PRIMARY KEY,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL,
          category TEXT NOT NULL,
          payment_type TEXT NOT NULL DEFAULT 'cash',
          notes TEXT NOT NULL DEFAULT '',
          incurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS expenses_incurred_at_idx
        ON expenses (incurred_at DESC)
      `;
    })().catch((error) => {
      expensesTableReady = null;
      throw error;
    });
  }
  await expensesTableReady;
}

function mapExpense(row: ExpenseRow): Expense {
  const category = isValidExpenseCategory(row.category)
    ? row.category
    : "other";

  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    category,
    paymentType: normalizePaymentType(row.payment_type),
    notes: row.notes ?? "",
    incurredAt: new Date(row.incurred_at).toISOString(),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function normalizeDescription(value: string): string {
  const description = value.trim();
  if (!description) {
    throw new Error("Description is required.");
  }
  if (description.length > 200) {
    throw new Error("Description must be 200 characters or fewer.");
  }
  return description;
}

function normalizeAmount(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error("Amount must be a whole peso amount greater than 0.");
  }
  if (value > 10_000_000) {
    throw new Error("Amount is too large.");
  }
  return value;
}

function normalizeNotes(value: string | undefined): string {
  const notes = value?.trim() ?? "";
  if (notes.length > 500) {
    throw new Error("Notes must be 500 characters or fewer.");
  }
  return notes;
}

function normalizeIncurredAt(value: string | undefined): string {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Expense date is invalid.");
  }
  return parsed.toISOString();
}

export async function getExpenses(): Promise<Expense[]> {
  await ensureExpensesTable();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM expenses
    ORDER BY incurred_at DESC, created_at DESC
  `;
  return (rows as ExpenseRow[]).map(mapExpense);
}

export async function getExpenseById(id: string): Promise<Expense | null> {
  await ensureExpensesTable();
  const sql = getSql();
  const rows = await sql`
    SELECT *
    FROM expenses
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapExpense(rows[0] as ExpenseRow);
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  await ensureExpensesTable();
  const sql = getSql();
  const id = generateId("exp");
  const description = normalizeDescription(input.description);
  const amount = normalizeAmount(input.amount);
  const category: ExpenseCategory = input.category;
  const paymentType: PaymentType = normalizePaymentType(input.paymentType);
  const notes = normalizeNotes(input.notes);
  const incurredAt = normalizeIncurredAt(input.incurredAt);
  const createdAt = new Date().toISOString();

  await sql`
    INSERT INTO expenses (
      id, description, amount, category, payment_type, notes, incurred_at, created_at
    )
    VALUES (
      ${id},
      ${description},
      ${amount},
      ${category},
      ${paymentType},
      ${notes},
      ${incurredAt},
      ${createdAt}
    )
  `;

  const created = await getExpenseById(id);
  if (!created) throw new Error("Failed to save expense.");
  return created;
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput
): Promise<Expense> {
  await ensureExpensesTable();
  const existing = await getExpenseById(id);
  if (!existing) {
    throw new Error("Expense not found.");
  }

  const sql = getSql();
  const description = normalizeDescription(input.description);
  const amount = normalizeAmount(input.amount);
  const category: ExpenseCategory = input.category;
  const paymentType: PaymentType = normalizePaymentType(input.paymentType);
  const notes = normalizeNotes(input.notes);
  const incurredAt = normalizeIncurredAt(input.incurredAt);

  await sql`
    UPDATE expenses
    SET
      description = ${description},
      amount = ${amount},
      category = ${category},
      payment_type = ${paymentType},
      notes = ${notes},
      incurred_at = ${incurredAt}
    WHERE id = ${id}
  `;

  const updated = await getExpenseById(id);
  if (!updated) throw new Error("Failed to update expense.");
  return updated;
}

export async function deleteExpense(id: string): Promise<void> {
  await ensureExpensesTable();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM expenses WHERE id = ${id} RETURNING id
  `;
  if (rows.length === 0) {
    throw new Error("Expense not found.");
  }
}
