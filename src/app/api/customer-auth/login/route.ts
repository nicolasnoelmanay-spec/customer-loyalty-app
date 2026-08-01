import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { authenticateCustomer } from "@/lib/data/neon-repository";
import {
  createCustomerSession,
  setCustomerSessionCookie,
} from "@/lib/auth/customer-session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body.username?.trim();
    const password = body.password;

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    const customer = await authenticateCustomer({ username, password });
    if (!customer) {
      return jsonError("Invalid username or password.", 401);
    }

    const sessionId = await createCustomerSession(customer.id);
    await setCustomerSessionCookie(sessionId);

    return NextResponse.json({ customer });
  } catch (error) {
    return handleRouteError(error, "Failed to sign in.");
  }
}
