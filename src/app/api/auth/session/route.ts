import { getStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";

export async function GET() {
  try {
    const staff = await getStaffSession();
    if (!staff) {
      return jsonError("Unauthorized", 401);
    }
    return jsonResponse(staff);
  } catch (error) {
    return handleRouteError(error);
  }
}
