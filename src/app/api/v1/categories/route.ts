import { NextResponse, type NextRequest } from "next/server";
import { listPublicCategories } from "@/modules/catalog";
import { handleApiError } from "@/lib/api";

/**
 * GET /api/v1/categories?includeEmpty=1
 * تصنيفات المتجر الظاهرة مع عدد المنتجات المنشورة في كل تصنيف.
 * store_id يأتي حالياً من الهيدر x-store-id؛ يُستبدل بالمصادقة وسياق الدومين لاحقاً.
 */
export async function GET(request: NextRequest) {
  try {
    const storeId = request.headers.get("x-store-id");
    if (!storeId) return NextResponse.json({ error: { code: "MISSING_STORE" } }, { status: 400 });

    const includeEmpty = request.nextUrl.searchParams.get("includeEmpty") === "1";
    const data = await listPublicCategories(storeId, { includeEmpty });
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}
