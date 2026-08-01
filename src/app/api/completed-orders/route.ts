import { NextResponse } from "next/server";
import { handleRouteError, requireStaffSession } from "@/lib/api/route-utils";
import { getCompletedOrders } from "@/lib/data/neon-repository";

export async function GET() {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const orders = await getCompletedOrders();
    return NextResponse.json({ orders });
  } catch (error) {
    return handleRouteError(error, "Failed to load completed orders.");
  }
}
