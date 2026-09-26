import { NextResponse, type NextRequest } from "next/server";
import { processPendingEvents } from "@/modules/system";
import { reviewProvidersIfDue } from "@/modules/providers";

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
  // إيقاف مزوّدي المحتوى الذين انتهت مستنداتهم (مرة كل 6 ساعات). فشله لا يوقف معالجة الأحداث.
  let providers: Awaited<ReturnType<typeof reviewProvidersIfDue>> = null;
  try {
    providers = await reviewProvidersIfDue();
  } catch (error) {
    console.error("reviewProvidersIfDue failed", error);
  }
  return NextResponse.json({ ...result, providersSuspended: providers });
}
