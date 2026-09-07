import { NextResponse, type NextRequest } from "next/server";
import { reconcileAllStores } from "@/modules/feeds";

/**
 * POST /api/internal/reconcile-merchant
 * المطابقة الليلية: انحراف + إعادة رفع ما قارب الانتهاء + أسباب الرفض.
 * مجدول يومياً (٣ فجراً)، محمي بـ x-cron-secret.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ stores: await reconcileAllStores() });
}
