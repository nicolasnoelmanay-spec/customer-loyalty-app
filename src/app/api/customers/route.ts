import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { addCustomer } from "@/lib/data/neon-repository";
import { sendWelcomeEmailSafely } from "@/lib/email/welcome-email";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const email = body.email?.trim();
    const username = body.username?.trim();
    const password = body.password;

    if (!name || !phone || !email || !username || !password) {
      return jsonError(
        "Name, phone, email, username, and password are required.",
        400
      );
    }

    const customer = await addCustomer({
      name,
      phone,
      email,
      username,
      password,
    });

    void sendWelcomeEmailSafely({
      name: customer.name,
      email: customer.email,
      username: customer.username,
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to add customer.");
  }
}
