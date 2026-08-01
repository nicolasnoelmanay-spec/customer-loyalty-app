import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import {
  findCustomerByContact,
  getTransactionsForCustomer,
} from "@/lib/data/neon-repository";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query) {
      return jsonError("Query parameter q is required.", 400);
    }

    const customer = await findCustomerByContact(query);
    if (!customer) {
      return NextResponse.json({ customer: null, transactions: [] });
    }

    const transactions = await getTransactionsForCustomer(customer.id);
    return NextResponse.json({ customer, transactions });
  } catch (error) {
    return handleRouteError(error, "Failed to look up customer.");
  }
}
