import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { createExpense, getExpenses } from "@/lib/data/expense-repository";
import { isValidExpenseCategory } from "@/lib/expense-categories";
import { normalizePaymentType } from "@/lib/data/pending-order-utils";
import type { PaymentType } from "@/types";

const paymentTypes = new Set<PaymentType>(["cash", "gcash"]);

function isValidPaymentType(value: unknown): value is PaymentType {
  return typeof value === "string" && paymentTypes.has(value as PaymentType);
}

function parseAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

export async function GET() {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const expenses = await getExpenses();
    return NextResponse.json({ expenses });
  } catch (error) {
    return handleRouteError(error, "Failed to load expenses.");
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const description =
      typeof body.description === "string" ? body.description : "";
    const amount = parseAmount(body.amount);
    const category = body.category;
    const incurredAt =
      typeof body.incurredAt === "string" ? body.incurredAt : undefined;
    const notes = typeof body.notes === "string" ? body.notes : undefined;

    if (!description.trim()) {
      return jsonError("Description is required.", 400);
    }
    if (amount === null || amount <= 0) {
      return jsonError("Amount must be a whole peso amount greater than 0.", 400);
    }
    if (!isValidExpenseCategory(category)) {
      return jsonError("Select a valid expense category.", 400);
    }

    const paymentType =
      body.paymentType === undefined
        ? "cash"
        : isValidPaymentType(body.paymentType)
          ? body.paymentType
          : null;
    if (paymentType === null) {
      return jsonError("Payment type must be Cash or GCash.", 400);
    }

    const expense = await createExpense({
      description,
      amount,
      category,
      paymentType: normalizePaymentType(paymentType),
      notes,
      incurredAt,
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to save expense.");
  }
}
