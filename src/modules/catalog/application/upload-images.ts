import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { products, productMedia } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";
import { storage } from "@/infrastructure/storage";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

/** يرفع عدة ملفات صور إلى التخزين ويضيفها لمنتج. أول صورة تصبح رئيسية إن لم توجد صور. */
export async function uploadProductImages(ctx: StoreContext, productId: string, files: File[]) {
  requireRole(ctx, "owner", "admin", "staff");
  const product = await db.query.products.findFirst({ where: and(eq(products.storeId, ctx.storeId), eq(products.id, productId)) });
  if (!product) throw new NotFoundError("المنتج", productId);

  const existing = await db.select({ id: productMedia.id }).from(productMedia).where(eq(productMedia.productId, productId));
  let position = existing.length;
  let firstEver = existing.length === 0;
  let added = 0;

  for (const file of files) {
    if (file.size === 0) continue;
    if (!ALLOWED.has(file.type)) throw new ValidationError(`نوع ملف غير مدعوم: ${file.type || "غير معروف"}`);
    if (file.size > 8 * 1024 * 1024) throw new ValidationError("حجم الصورة يتجاوز 8MB");

    const ext = file.type.split("/")[1] ?? "jpg";
    const key = `stores/${ctx.storeId}/products/${productId}/${crypto.randomUUID()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { url } = await storage.upload(key, buf, file.type);

    await db.insert(productMedia).values({ productId, type: "image", url, position: position++, isPrimary: firstEver });
    firstEver = false;
    added++;
  }
  return { added };
}
