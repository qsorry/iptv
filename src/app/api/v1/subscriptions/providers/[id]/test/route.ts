import { NextResponse, type NextRequest } from "next/server";
import { testProvider } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

/** POST /api/v1/subscriptions/providers/:id/test — اختبار الاتصال بالمزوّد. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiStoreContext(request);
    const { id } = await params;
    return NextResponse.json({ data: await testProvider(ctx, id) });
  } catch (error) {
    return handleApiError(error);
  }
}
