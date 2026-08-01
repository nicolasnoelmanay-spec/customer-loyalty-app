import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { getCustomerSession } from "@/lib/auth/customer-session";
import {
  getCustomerById,
  getCustomerTotalVoucherSavings,
  getTransactionsForCustomer,
  updateCustomerProfile,
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

    const [transactions, totalVoucherSavings] = await Promise.all([
      getTransactionsForCustomer(customer.id),
      getCustomerTotalVoucherSavings(customer.id),
    ]);
    return NextResponse.json({
      customer,
      transactions: transactions.slice(0, 10),
      totalVoucherSavings,
    });
  } catch (error) {
    return handleRouteError(error, "Failed to load account.");
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getCustomerSession();
    if (!session) {
      return jsonError("Unauthorized.", 401);
    }

    const body = await request.json();
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const email = body.email?.trim();

    if (!name || !phone || !email) {
      return jsonError("Name, phone, and email are required.", 400);
    }

    const customer = await updateCustomerProfile({
      customerId: session.customerId,
      name,
      phone,
      email,
    });

    const totalVoucherSavings = await getCustomerTotalVoucherSavings(customer.id);

    return NextResponse.json({ customer, totalVoucherSavings });
  } catch (error) {
    return handleRouteError(error, "Failed to update profile.");
  }
}
