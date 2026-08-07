import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { canManageTransactionHistory } from "@/config/auth";
import { clearTransactionHistory } from "@/lib/data/neon-repository";

export async function DELETE() {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    if (!canManageTransactionHistory(auth.session.username)) {
      return jsonError("Only admin2 can clear transaction history.", 403);
    }

    await clearTransactionHistory();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to clear transaction history.");
  }
}
