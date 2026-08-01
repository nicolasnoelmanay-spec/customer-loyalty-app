import { requireStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";

export async function DELETE() {
  try {
    await requireStaffSession();
    const repository = getPrismaLoyaltyRepository();
    await repository.clearTransactionHistory();
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
