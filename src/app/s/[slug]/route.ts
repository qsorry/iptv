import { NextResponse, type NextRequest } from "next/server";

/**
 * الوصول للمتجر عبر مجلد: /s/<slug> يضبط كوكي المتجر النشط ثم يحوّل للصفحة الرئيسية.
 * يبني التحويل من ترويسة Host الحقيقية (خلف بروكسي) لا من عنوان الخادم الداخلي.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const res = NextResponse.redirect(`${proto}://${host}/`);
  res.cookies.set("store_preview", slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
