import { NextResponse, type NextRequest } from "next/server";
import { listMappings, upsertMapping, deleteMapping } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

/** GET /api/v1/subscriptions/mappings — ربط المتغيّرات بالمزوّدين. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    return NextResponse.json({ data: await listMappings(ctx) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** PUT /api/v1/subscriptions/mappings — إنشاء/تحديث ربط { variantId, providerId, packageId, params? }. */
export async function PUT(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    return NextResponse.json({ data: await upsertMapping(ctx, await request.json()) });
  } catch (error) {
    return handleApiError(error);
  }
}

/** DELETE /api/v1/subscriptions/mappings?id=... */
export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    const id = request.nextUrl.searchParams.get("id") ?? "";
    await deleteMapping(ctx, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
