import { NextResponse, type NextRequest } from "next/server";
import { processMerchantQueue } from "@/modules/feeds";

/**
 * POST /api/internal/process-merchant
 * عامل مزامنة Merchant Center. يستدعيه المجدول كل دقيقة، محمي بـ x-cron-secret.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 500;
  return NextResponse.json(await processMerchantQueue(Math.min(Math.max(limit, 1), 1000)));
}
