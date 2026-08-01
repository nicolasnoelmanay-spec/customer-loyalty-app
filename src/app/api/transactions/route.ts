import { NextResponse } from "next/server";
import { handleRouteError, requireStaffSession } from "@/lib/api/route-utils";
import { clearTransactionHistory } from "@/lib/data/neon-repository";

export async function DELETE() {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    await clearTransactionHistory();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to clear transaction history.");
  }
}
