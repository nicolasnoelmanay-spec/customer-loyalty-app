import { NextResponse } from "next/server";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleRouteError(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return jsonError("Unauthorized", 401);
    }
    return jsonResponse({ error: error.message }, 400);
  }
  return jsonError("Internal server error", 500);
}

export function jsonResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}
