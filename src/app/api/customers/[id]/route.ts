import { NextRequest } from "next/server";
import { requireStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";
import { getPrismaLoyaltyRepository } from "@/lib/data/prisma-repository";
import type { UpdateCustomerInput } from "@/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireStaffSession();
    const { id } = await params;
    const body = (await request.json()) as Omit<UpdateCustomerInput, "customerId">;

    if (!body.name?.trim() || !body.phone?.trim() || !body.email?.trim()) {
      return jsonError("Name, phone, and email are required.");
    }
    if (typeof body.points !== "number") {
      return jsonError("Points are required.");
    }

    const repository = getPrismaLoyaltyRepository();
    const customer = await repository.updateCustomer({
      customerId: id,
      ...body,
    });
    return jsonResponse(customer);
  } catch (error) {
    return handleRouteError(error);
  }
}
