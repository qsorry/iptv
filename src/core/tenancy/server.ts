import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { storeMembers, stores, storeDomains } from "@/infrastructure/database/schema";
import { auth } from "@/lib/auth";
import { ACTIVE_STORE_COOKIE, TENANT_HEADERS, type StoreContext } from "./index";

/** الجلسة الحالية أو null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** الجلسة الحالية أو تحويل لصفحة الدخول. */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/auth");
  return session;
}

/**
 * سياق لوحة التحكم: مستخدم مسجّل + متجر نشط يملك عضوية فيه.
 * المتجر النشط من الكوكي، وإلا أول عضوية للمستخدم.
 */
export async function getAdminContext(): Promise<StoreContext & { storeName: string; storeSlug: string; userEmail: string }> {
  const session = await requireSession();
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_STORE_COOKIE)?.value;

  const memberships = await db
    .select({ storeId: storeMembers.storeId, role: storeMembers.role, storeName: stores.name, storeSlug: stores.slug })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .where(and(eq(storeMembers.userId, session.user.id), eq(storeMembers.status, "active")));

  const active = memberships.find((m) => m.storeId === preferred) ?? memberships[0];
  if (!active) redirect("/admin/onboarding");

  return { storeId: active.storeId, role: active.role, userId: session.user.id, storeName: active.storeName, storeSlug: active.storeSlug, userEmail: session.user.email };
}

/** المتجر الذي تعرضه واجهة المتجر، بناءً على الهيدرات التي وضعها middleware. */
export async function getStorefrontStore() {
  const h = await headers();
  const slug = h.get(TENANT_HEADERS.slug);
  const domain = h.get(TENANT_HEADERS.customDomain);

  if (slug) return db.query.stores.findFirst({ where: and(eq(stores.slug, slug), eq(stores.status, "active")) });
  if (domain) {
    const row = await db
      .select({ store: stores })
      .from(storeDomains)
      .innerJoin(stores, eq(stores.id, storeDomains.storeId))
      .where(and(eq(storeDomains.domain, domain), eq(stores.status, "active")))
      .limit(1);
    return row[0]?.store ?? null;
  }
  return null;
}
