import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/route-utils";
import { getProducts } from "@/lib/data/neon-repository";

export async function GET() {
  try {
    const products = await getProducts();
    return NextResponse.json({ products });
  } catch (error) {
    return handleRouteError(error, "Failed to load products.");
  }
}
