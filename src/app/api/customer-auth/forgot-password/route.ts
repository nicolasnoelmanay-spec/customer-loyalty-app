import { NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import { requestPasswordReset } from "@/lib/data/neon-repository";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";

    if (!email || !email.includes("@")) {
      return jsonError("A valid email address is required.", 400);
    }

    await requestPasswordReset(email);

    return NextResponse.json({
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    return handleRouteError(error, "Failed to request password reset.");
  }
}
