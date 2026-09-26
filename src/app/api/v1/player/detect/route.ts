import { NextResponse, type NextRequest } from "next/server";
import { detectServer } from "@/modules/player";
import { handleApiError } from "@/lib/api";
import { corsPreflight, withCors } from "@/lib/cors";
import { clientIp, rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/v1/player/detect?username=394218775
 * يتعرّف تطبيق المشغّل على المزوّد والخادم من بادئة اسم المستخدم أثناء الكتابة.
 * { data: { provider: { name }, server: { label, url } } | null }
 */
export async function GET(request: NextRequest) {
  try {
    rateLimit(`player:detect:${clientIp(request)}`, 60, 60_000);
    const username = request.nextUrl.searchParams.get("username") ?? "";
    const found = await detectServer(username.slice(0, 120));
    const data = found ? { provider: { name: found.provider.name }, server: { label: found.server.label, url: found.server.url } } : null;
    return withCors(NextResponse.json({ data }));
  } catch (error) {
    return withCors(handleApiError(error));
  }
}

export const OPTIONS = corsPreflight;
