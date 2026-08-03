import { NextResponse } from "next/server";
import { handleRouteError, requireStaffSession } from "@/lib/api/route-utils";
import { deleteTransaction } from "@/lib/data/neon-repository";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    await deleteTransaction(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete transaction.");
  }
}
