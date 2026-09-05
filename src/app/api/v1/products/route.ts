import { NextResponse, type NextRequest } from "next/server";
import { paginationSchema } from "@/core/pagination";
import { productRepository } from "@/modules/catalog";
import { handleApiError } from "@/lib/api";

/**
 * GET /api/v1/products?page=1&perPage=20
 * store_id يأتي حالياً من الهيدر x-store-id؛ يُستبدل بالمصادقة وسياق الدومين لاحقاً.
 */
export async function GET(request: NextRequest) {
  try {
    const storeId = request.headers.get("x-store-id");
    if (!storeId) return NextResponse.json({ error: { code: "MISSING_STORE" } }, { status: 400 });

    const pagination = paginationSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await productRepository.list(storeId, pagination);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
