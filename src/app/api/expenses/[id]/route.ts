import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { deleteExpense, updateExpense } from "@/lib/data/expense-repository";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const description =
      typeof body.description === "string" ? body.description : "";
    const amount = parseAmount(body.amount);
    const category = body.category;
    const incurredAt =
      typeof body.incurredAt === "string" ? body.incurredAt : "";
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
    if (!incurredAt) {
      return jsonError("Expense date is required.", 400);
    }
    if (!isValidPaymentType(body.paymentType)) {
      return jsonError("Payment type must be Cash or GCash.", 400);
    }

    const expense = await updateExpense(id, {
      description,
      amount,
      category,
      paymentType: normalizePaymentType(body.paymentType),
      notes,
      incurredAt,
    });

    return NextResponse.json(expense);
  } catch (error) {
    return handleRouteError(error, "Failed to update expense.");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    await deleteExpense(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete expense.");
  }
}
