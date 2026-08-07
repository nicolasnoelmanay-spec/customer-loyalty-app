import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { canManageTransactionHistory } from "@/config/auth";
import { deleteTransaction } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    if (!canManageTransactionHistory(auth.session.username)) {
      return jsonError("Only admin2 can delete transactions.", 403);
    }

    const { id } = await params;
    await deleteTransaction(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete transaction.");
  }
}
