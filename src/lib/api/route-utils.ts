import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth/staff-session";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireStaffSession() {
  const session = await getStaffSession();
  if (!session) {
    return { error: jsonError("Unauthorized.", 401) } as const;
  }
  return { session } as const;
}

export function handleRouteError(error: unknown, context: string) {
  console.error(context, error);
  const message =
    error instanceof Error ? error.message : "Something went wrong.";
  return jsonError(message, 500);
}
