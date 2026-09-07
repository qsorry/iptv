import { NextResponse, type NextRequest } from "next/server";
import { paginationSchema } from "@/core/pagination";
import { productRepository, UNCATEGORIZED } from "@/modules/catalog";
import { handleApiError } from "@/lib/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/v1/products?page=1&perPage=20&category=<id|none>
 * store_id يأتي حالياً من الهيدر x-store-id؛ يُستبدل بالمصادقة وسياق الدومين لاحقاً.
 */
export async function GET(request: NextRequest) {
  try {
    const storeId = request.headers.get("x-store-id");
    if (!storeId) return NextResponse.json({ error: { code: "MISSING_STORE" } }, { status: 400 });

    const pagination = paginationSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    // يُقبل معرّف UUID أو "none" لغير المصنّفة؛ أي قيمة أخرى تُتجاهل.
    const raw = request.nextUrl.searchParams.get("category");
    const category = raw === UNCATEGORIZED || (raw && UUID_RE.test(raw)) ? raw : undefined;
    const result = await productRepository.list(storeId, pagination, { categoryId: category });
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
