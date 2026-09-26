import { NextResponse, type NextRequest } from "next/server";
import { checkActivationCode, redeemActivationCode } from "@/modules/player";
import { handleApiError } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/v1/player/activate { code: "SN-XXXX-XXXX" }
 * يستبدل كود التفعيل ببيانات الحساب: { data: { provider, server, username, password } }.
 * { code, dryRun: true }: تحقق فقط بلا استخدام ولا تسجيل ولا بيانات حساب: { data: { provider, server: { label } } }.
 * كل أسباب الفشل ترجع 404 برسالة واحدة.
 */
export async function POST(request: NextRequest) {
  try {
    rateLimit(`player:activate:${clientIp(request)}`, 10, 60_000);
    const body = (await request.json().catch(() => ({}))) as { code?: unknown; dryRun?: unknown };
    const data = body.dryRun === true ? await checkActivationCode(body.code) : await redeemActivationCode(body.code);
    return withCors(NextResponse.json({ data }));
  } catch (error) {
    return withCors(handleApiError(error));
  }
}

export const OPTIONS = corsPreflight;
