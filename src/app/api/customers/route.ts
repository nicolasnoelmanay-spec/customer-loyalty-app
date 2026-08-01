import { NextRequest } from "next/server";
import { requireStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";
import type { CreateCustomerInput } from "@/types";

export async function POST(request: NextRequest) {
  try {
    await requireStaffSession();
    const input = (await request.json()) as CreateCustomerInput;

    if (!input.name?.trim() || !input.phone?.trim() || !input.email?.trim()) {
      return jsonError("Name, phone, and email are required.");
    }

    const repository = getPrismaLoyaltyRepository();
    const customer = await repository.addCustomer(input);
    return jsonResponse(customer, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
