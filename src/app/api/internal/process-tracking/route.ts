import { NextResponse, type NextRequest } from "next/server";
import { processTrackingQueue } from "@/modules/tracking";

/**
 * POST /api/internal/process-tracking
 * عامل طابور التتبّع. يستدعيه مجدول Coolify كل دقيقة، محمي بـ x-cron-secret.
 * منفصل عن معالج outbox حتى لا يتأخر تسليم الأكواد بسبب بطء منصة إعلانية.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Number(request.nextUrl.searchParams.get("limit")) || 25;
  const result = await processTrackingQueue(Math.min(Math.max(limit, 1), 200));
  return NextResponse.json(result);
}
