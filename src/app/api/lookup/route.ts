import { NextRequest } from "next/server";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";
import { ensureDbReady, handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";

export async function GET(request: NextRequest) {
  try {
    await ensureDbReady();
    const contact = request.nextUrl.searchParams.get("contact");
    if (!contact?.trim()) {
      return jsonError("Contact query parameter is required.");
    }

    const repository = getPrismaLoyaltyRepository();
    const customer = await repository.findCustomerByContact(contact);
    if (!customer) {
      return jsonError("Customer not found.", 404);
    }

    const transactions = await repository.getTransactionsForCustomer(customer.id);
    return jsonResponse({ customer, transactions });
  } catch (error) {
    return handleRouteError(error);
  }
}
