import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { setStaffSession } from "@/lib/auth/staff-session";
import { ensureDbReady, handleRouteError, jsonError, jsonResponse } from "@/lib/api/route-utils";

export async function POST(request: NextRequest) {
  try {
    await ensureDbReady();

    const { username, password } = (await request.json()) as {
      username?: string;
      password?: string;
    };

    if (!username?.trim() || !password) {
      return jsonError("Username and password are required.");
    }

    const staff = await prisma.staff.findUnique({
      where: { username: username.trim() },
    });

    if (!staff || !(await bcrypt.compare(password, staff.passwordHash))) {
      return jsonError("Invalid username or password.", 401);
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
