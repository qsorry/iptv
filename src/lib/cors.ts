import { NextResponse } from "next/server";

/**
 * واجهات عامة يستدعيها تطبيق المشغّل من أصول مختلفة (file:// على التلفاز، localhost في غلاف الجوال).
 * لا كوكيز فيها، لذا نسمح بأي أصل.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function withCors(response: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) response.headers.set(k, v);
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function corsPreflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
