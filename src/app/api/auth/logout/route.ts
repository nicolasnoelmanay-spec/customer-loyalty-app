import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/route-utils";
import { clearStaffSession } from "@/lib/auth/staff-session";

export async function POST() {
  try {
    await clearStaffSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to sign out.");
  }
}
