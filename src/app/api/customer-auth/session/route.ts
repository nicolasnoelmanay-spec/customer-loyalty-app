import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/auth/customer-session";

export async function GET() {
  const session = await getCustomerSession();
  return NextResponse.json({ authenticated: Boolean(session) });
}
