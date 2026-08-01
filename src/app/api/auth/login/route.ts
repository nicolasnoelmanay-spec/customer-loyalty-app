import { NextRequest, NextResponse } from "next/server";
import { handleRouteError, jsonError } from "@/lib/api/route-utils";
import {
  createStaffSession,
  setSessionCookie,
} from "@/lib/auth/staff-session";
import { verifyStaffCredentials } from "@/lib/data/neon-repository";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = body.username?.trim();
    const password = body.password;

    if (!username || !password) {
      return jsonError("Username and password are required.", 400);
    }

    const staff = await verifyStaffCredentials(username, password);
    if (!staff) {
      return jsonError("Invalid username or password.", 401);
    }

    const sessionId = await createStaffSession(staff.id);
    await setSessionCookie(sessionId);

    return NextResponse.json({ ok: true, username: staff.username });
  } catch (error) {
    return handleRouteError(error, "Failed to sign in.");
  }
}
