import { NextResponse } from "next/server";

/** نقطة تجديد جلسة Supabase وحماية المسارات. أكمل المنطق عند إضافة المصادقة. */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
