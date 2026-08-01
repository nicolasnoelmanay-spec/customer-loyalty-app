import { NextResponse } from "next/server";
import { handleRouteError, requireStaffSession } from "@/lib/api/route-utils";
import { getLoyaltyData } from "@/lib/data/neon-repository";

export async function GET() {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const data = await getLoyaltyData();
    return NextResponse.json(data);
  } catch (error) {
    return handleRouteError(error, "Failed to load loyalty data.");
  }
}
