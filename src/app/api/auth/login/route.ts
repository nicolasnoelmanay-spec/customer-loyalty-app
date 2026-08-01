import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { ensureDatabaseInitialized } from "@/lib/db/initialize-database";
import { setStaffSession } from "@/lib/auth/staff-session";
import { handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";

export async function POST(request: NextRequest) {
  try {
    await ensureDatabaseInitialized();

    const { username } = (await request.json()) as { username?: string };

    if (!username?.trim()) {
      return jsonError("Username is required.");
    }

    const staff = await prisma.staff.findUnique({
      where: { username: username.trim() },
    });

    if (!staff) {
      return jsonError("Unknown username.", 401);
    }

    await setStaffSession(staff.id);

    return jsonResponse({
      id: staff.id,
      username: staff.username,
      name: staff.name,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
