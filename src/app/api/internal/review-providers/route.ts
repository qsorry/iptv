import { NextResponse, type NextRequest } from "next/server";
import { suspendProvidersWithExpiredDocuments } from "@/modules/providers";

/**
 * POST /api/internal/review-providers
 * يوقف المزوّدين المفعّلين الذين انتهت صلاحية أحد مستنداتهم المطلوبة.
 * مجدول يومياً، محمي بـ x-cron-secret.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ suspended: await suspendProvidersWithExpiredDocuments() });
}
