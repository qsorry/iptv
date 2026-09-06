import { NextResponse, type NextRequest } from "next/server";

/**
 * الوصول للمتجر عبر مجلد: /s/<slug> يضبط كوكي المتجر النشط ثم يحوّل للصفحة الرئيسية.
 * يعمل على الدومين الرئيسي بلا حاجة لنطاق فرعي.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = request.nextUrl.clone();
  url.pathname = "/";
  const res = NextResponse.redirect(url);
  res.cookies.set("store_preview", slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
