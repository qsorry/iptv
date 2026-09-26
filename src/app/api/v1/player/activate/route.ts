import { NextResponse, type NextRequest } from "next/server";
import { redeemActivationCode } from "@/modules/player";
import { handleApiError } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/v1/player/activate { code: "SN-XXXX-XXXX" }
 * يستبدل كود التفعيل ببيانات الحساب: { data: { provider, server, username, password } }.
 * كل أسباب الفشل ترجع 404 برسالة واحدة.
 */
export async function POST(request: NextRequest) {
  try {
    rateLimit(`player:activate:${clientIp(request)}`, 10, 60_000);
    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    const data = await redeemActivationCode(typeof body.code === "string" ? body.code : "");
    return withCors(NextResponse.json({ data }));
  } catch (error) {
    return withCors(handleApiError(error));
  }
}

export const OPTIONS = corsPreflight;
