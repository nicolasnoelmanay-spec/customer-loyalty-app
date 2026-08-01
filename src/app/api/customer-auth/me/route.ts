import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { getCustomerSession } from "@/lib/auth/customer-session";
import {
  getCustomerById,
  getTransactionsForCustomer,
} from "@/lib/data/neon-repository";

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return jsonError("Unauthorized.", 401);
    }

    const customer = await getCustomerById(session.customerId);
    if (!customer) {
      return jsonError("Member not found.", 404);
    }

    const transactions = await getTransactionsForCustomer(customer.id);
    return NextResponse.json({
      customer,
      transactions: transactions.slice(0, 10),
    });
  } catch (error) {
    return handleRouteError(error, "Failed to load account.");
  }
}
