import { NextResponse } from "next/server";
import {
  handleRouteError,
  jsonError,
  requireStaffSession,
} from "@/lib/api/route-utils";
import { isValidDrinkTemperature } from "@/lib/data/drink-temperature";
import { isValidQuarterPounderOption } from "@/lib/data/quarter-pounder-options";
import {
  deletePendingOrder,
  updatePendingOrder,
} from "@/lib/data/neon-repository";
import type { VoucherApplyOption } from "@/types";

const voucherOptions = new Set<VoucherApplyOption>([
  "none",
  "voucher",
  "free-drink-voucher",
]);

function isValidVoucherApplyOption(value: unknown): value is VoucherApplyOption {
  return typeof value === "string" && voucherOptions.has(value as VoucherApplyOption);
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    const body = await request.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return jsonError("Add at least one product.", 400);
    }

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        typeof item.quantity !== "number" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return jsonError("Each item needs a productId and positive quantity.", 400);
      }
      if (
        item.temperature !== undefined &&
        !isValidDrinkTemperature(item.temperature)
      ) {
        return jsonError("Temperature must be hot or iced.", 400);
      }
      if (
        item.quarterPounderOption !== undefined &&
        !isValidQuarterPounderOption(item.quarterPounderOption)
      ) {
        return jsonError("Invalid Quarter Pounder add-on.", 400);
      }
    }

    const voucherToApply = body.voucherToApply;
    if (
      voucherToApply !== undefined &&
      !isValidVoucherApplyOption(voucherToApply)
    ) {
      return jsonError("Invalid voucher selection.", 400);
    }

    const order = await updatePendingOrder(id, {
      items,
      notes: typeof body.notes === "string" ? body.notes.trim() : undefined,
      voucherToApply,
    });

    return NextResponse.json(order);
  } catch (error) {
    return handleRouteError(error, "Failed to update pending order.");
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const auth = await requireStaffSession();
    if ("error" in auth) return auth.error;

    const { id } = await params;
    await deletePendingOrder(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, "Failed to delete pending order.");
  }
}
