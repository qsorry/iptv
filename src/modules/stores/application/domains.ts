import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { stores, storeDomains } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors";
import { isValidSubdomain, isReservedSubdomain, isValidHostname } from "@/lib/subdomain";

/** تغيير الـ subdomain (slug) للمتجر. */
export async function updateSubdomain(ctx: StoreContext, raw: string) {
  requireRole(ctx, "owner", "admin");
  const value = raw.trim().toLowerCase();
  if (!isValidSubdomain(value)) throw new ValidationError("العنوان يجب أن يكون أحرفاً إنجليزية وأرقاماً وشرطات فقط");
  if (isReservedSubdomain(value)) throw new ValidationError("هذا العنوان محجوز");

  const taken = await db.query.stores.findFirst({ where: eq(stores.slug, value) });
  if (taken && taken.id !== ctx.storeId) throw new ConflictError("هذا العنوان مستخدم من متجر آخر");

  const [row] = await db.update(stores).set({ slug: value, updatedAt: new Date() }).where(eq(stores.id, ctx.storeId)).returning();
  if (!row) throw new NotFoundError("المتجر", ctx.storeId);
  return row;
}

export function listDomains(storeId: string) {
  return db.select().from(storeDomains).where(eq(storeDomains.storeId, storeId));
}

/** إضافة دومين مخصص للمتجر (يبدأ غير موثّق حتى يتم التحقق من DNS). */
export async function addDomain(ctx: StoreContext, raw: string) {
  requireRole(ctx, "owner", "admin");
  const domain = raw.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!isValidHostname(domain)) throw new ValidationError("أدخل دوميناً صحيحاً مثل shop.example.com");

  const existing = await db.query.storeDomains.findFirst({ where: eq(storeDomains.domain, domain) });
  if (existing) throw new ConflictError("هذا الدومين مسجّل مسبقاً");

  const [row] = await db.insert(storeDomains).values({ storeId: ctx.storeId, domain }).returning();
  return row;
}

export async function removeDomain(ctx: StoreContext, domainId: string) {
  requireRole(ctx, "owner", "admin");
  await db.delete(storeDomains).where(and(eq(storeDomains.id, domainId), eq(storeDomains.storeId, ctx.storeId)));
}
