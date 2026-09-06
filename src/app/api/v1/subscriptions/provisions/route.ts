import { NextResponse, type NextRequest } from "next/server";
import { subscriptionRepository, provisionOrderNow } from "@/modules/subscriptions";
import { requireApiStoreContext } from "@/lib/api-store";
import { handleApiError } from "@/lib/api";

/** GET /api/v1/subscriptions/provisions?orderId= — سجل التزويد (كل المتجر أو لطلب). */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    const orderId = request.nextUrl.searchParams.get("orderId");
    const data = orderId ? await subscriptionRepository.provisionsForOrder(ctx.storeId, orderId) : await subscriptionRepository.listProvisions(ctx.storeId, 100);
    return NextResponse.json({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

/** POST /api/v1/subscriptions/provisions { orderId } — تشغيل التزويد لطلب مدفوع الآن. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireApiStoreContext(request);
    const { orderId } = (await request.json()) as { orderId?: string };
    return NextResponse.json({ data: await provisionOrderNow(ctx, String(orderId ?? "")) });
  } catch (error) {
    return handleApiError(error);
  }
}
