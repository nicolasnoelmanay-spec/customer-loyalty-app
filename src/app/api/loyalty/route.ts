import { requireStaffSession } from "@/lib/auth/staff-session";
import { ensureDbReady, handleRouteError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";

export async function GET() {
  try {
    await ensureDbReady();
    await requireStaffSession();
    const repository = getPrismaLoyaltyRepository();
    const data = await repository.getData();
    return jsonResponse(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
