import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { resolveTenantFromHost, TENANT_HEADERS } from "@/core/tenancy";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

/**
 * 1) يحدد المتجر من Host ويمرره كهيدر للطبقات التالية.
 * 2) حماية أولية لمسارات /admin بوجود كوكي الجلسة (التحقق الكامل في الخادم).
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const tenant = resolveTenantFromHost(host, PLATFORM_DOMAIN);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && !getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(TENANT_HEADERS.slug);
  requestHeaders.delete(TENANT_HEADERS.customDomain);
  if (tenant?.slug) requestHeaders.set(TENANT_HEADERS.slug, tenant.slug);
  if (tenant?.customDomain) requestHeaders.set(TENANT_HEADERS.customDomain, tenant.customDomain);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
