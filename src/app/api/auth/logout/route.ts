import { clearStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonResponse } from "@/lib/api/route-utils";

export async function POST() {
  try {
    await clearStaffSession();
    return jsonResponse({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
