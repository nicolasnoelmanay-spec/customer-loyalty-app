import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { registerMember } from "@/lib/data/neon-repository";

export async function POST(request: Request) {
  try {
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

    const customer = await registerMember({
      name,
      phone,
      email,
      username,
      password,
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "Failed to register member.");
  }
}
