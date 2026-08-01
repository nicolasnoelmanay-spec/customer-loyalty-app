import { NextRequest, NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { updateCustomer } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const name = body.name?.trim();
    const phone = body.phone?.trim();
    const email = body.email?.trim();
    const points = body.points;

    if (!name || !phone || !email) {
      return jsonError("Name, phone, and email are required.", 400);
    }
    if (typeof points !== "number" || !Number.isInteger(points) || points < 0) {
      return jsonError("Points must be a non-negative integer.", 400);
    }

    const customer = await updateCustomer({
      customerId: id,
      name,
      phone,
      email,
      points,
    });
    return NextResponse.json(customer);
  } catch (error) {
    return handleRouteError(error, "Failed to update customer.");
  }
}
