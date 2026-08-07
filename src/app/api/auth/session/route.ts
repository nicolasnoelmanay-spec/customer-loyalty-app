import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/staff-session";

export async function GET() {
  const session = await getStaffSession();
  return NextResponse.json({
    authenticated: Boolean(session),
    username: session?.username ?? null,
  });
}
