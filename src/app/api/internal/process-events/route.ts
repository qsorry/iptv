import { NextResponse, type NextRequest } from "next/server";
import { processPendingEvents } from "@/modules/system";

/**
 * POST /api/internal/process-events
 * يستدعيه مجدول Coolify كل دقيقة. محمي بترويسة x-cron-secret == CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await processPendingEvents();
  return NextResponse.json(result);
}
