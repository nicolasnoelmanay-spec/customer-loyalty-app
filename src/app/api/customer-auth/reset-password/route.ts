import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { resetCustomerPassword } from "@/lib/data/neon-repository";
import {
  createCustomerSession,
  setCustomerSessionCookie,
} from "@/lib/auth/customer-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const password = body.password;

    if (!token) {
      return jsonError("Reset token is required.", 400);
    }

    if (typeof password !== "string" || !password) {
      return jsonError("Password is required.", 400);
    }

    const customer = await resetCustomerPassword({ token, password });
    const sessionId = await createCustomerSession(customer.id);
    await setCustomerSessionCookie(sessionId);

    return NextResponse.json({ customer });
  } catch (error) {
    return handleRouteError(error, "Failed to reset password.");
  }
}
