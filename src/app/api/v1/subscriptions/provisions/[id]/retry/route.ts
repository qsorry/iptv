import { NextResponse, type NextRequest } from "next/server";
import { retryProvision } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

/** POST /api/v1/subscriptions/provisions/:id/retry — إعادة محاولة تزويد فاشل. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiStoreContext(request);
    const { id } = await params;
    return NextResponse.json({ data: await retryProvision(ctx, id) });
  } catch (error) {
    return handleApiError(error);
  }
}
