import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { digitalCodes, productVariants } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";

/** يفصل نص اللصق إلى أكواد فريدة (سطر لكل كود، ويقبل الفاصلة أيضاً). */
export function parseCodes(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[\r\n,]+/)) {
    const code = part.trim();
    if (code) seen.add(code);
  }
  return [...seen];
}

/**
 * إضافة مجموعة أكواد لـ variant. يتجاهل المكرر (داخل المدخل ومع الموجود مسبقاً).
 * يرجّع عدد المضاف وعدد المكرر.
 */
export async function addCodes(ctx: StoreContext, variantId: string, raw: string) {
  requireRole(ctx, "owner", "admin", "staff");

  const variant = await db.query.productVariants.findFirst({
    where: and(eq(productVariants.id, variantId), eq(productVariants.storeId, ctx.storeId)),
  });
  if (!variant) throw new NotFoundError("المتغيّر", variantId);

  const codes = parseCodes(raw);
  if (codes.length === 0) throw new ValidationError("لم يتم إدخال أي كود");

  // استبعاد ما هو موجود مسبقاً في نفس المتجر.
  const existing = await db
    .select({ code: digitalCodes.code })
    .from(digitalCodes)
    .where(and(eq(digitalCodes.storeId, ctx.storeId), inArray(digitalCodes.code, codes)));
  const existingSet = new Set(existing.map((e) => e.code));
  const fresh = codes.filter((c) => !existingSet.has(c));

  if (fresh.length > 0) {
    await db.insert(digitalCodes).values(
      fresh.map((code) => ({ storeId: ctx.storeId, variantId, code })),
    );
  }

  return { added: fresh.length, duplicates: codes.length - fresh.length };
}
