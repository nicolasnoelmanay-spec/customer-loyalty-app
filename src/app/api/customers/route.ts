import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { addCustomer } from "@/lib/data/neon-repository";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const email = body.email?.trim();

    if (!name || !phone || !email) {
      return jsonError("Name, phone, and email are required.", 400);
    }

    const customer = await addCustomer({ name, phone, email });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to add customer.");
  }
}
