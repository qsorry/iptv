import { NextResponse, type NextRequest } from "next/server";
import { listProviderPackages } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

/** GET /api/v1/subscriptions/providers/:id/packages — باقات المزوّد (إن دعمها قالبه). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await requireApiStoreContext(request);
    const { id } = await params;
    return NextResponse.json({ data: await listProviderPackages(ctx, id) });
  } catch (error) {
    return handleApiError(error);
  }
}
