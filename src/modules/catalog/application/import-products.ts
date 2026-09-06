import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { productMedia } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { createProduct } from "./create-product";
import { addProductImageUrl, updateProduct } from "./update-product";
import { productRepository } from "../infrastructure/product.repository";
import { slugify } from "@/lib/slugify";

/**
 * صف استيراد واحد. الحقول مرنة لتناسب تصدير سلة (أسماء الأعمدة الشائعة):
 * name, price, description, image / images, type, status.
 */
export interface ImportRow {
  name?: string;
  price?: string;
  description?: string;
  shortDescription?: string;
  images?: string[]; // روابط
  type?: string;
  status?: string;
}

const num = (v?: string) => {
  const m = (v ?? "").replace(/[^\d.]/g, "");
  return m && /^\d+(\.\d+)?$/.test(m) ? Number(m).toFixed(2) : null;
};

const mapType = (t?: string): "physical" | "digital" | "service" => {
  const v = (t ?? "").toLowerCase();
  if (v.includes("digital") || v.includes("code") || v.includes("رقم")) return "digital";
  if (v.includes("service") || v.includes("خدم")) return "service";
  return "physical";
};

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface ImportOptions {
  /** عند وجود منتج بنفس الـ slug: حدّث الوصف والسعر والصور بدل التخطّي. */
  updateExisting?: boolean;
}

/**
 * يستورد صفوف منتجات إلى المتجر.
 * - افتراضياً يتخطّى المكرر (نفس الـ slug).
 * - مع `updateExisting` يحدّث الوصف/الوصف المختصر/السعر، ويضيف الصور إن لم تكن للمنتج صور.
 * يجمع الأخطاء دون إيقاف.
 */
export async function importProducts(ctx: StoreContext, rows: ImportRow[], options: ImportOptions = {}): Promise<ImportResult> {
  requireRole(ctx, "owner", "admin");
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of rows) {
    const name = (row.name ?? "").trim();
    const price = num(row.price);
    if (!name || !price) {
      result.failed++;
      if (result.errors.length < 20) result.errors.push(`صف غير مكتمل: "${name || "بدون اسم"}"`);
      continue;
    }

    const slug = slugify(name);
    const exists = await productRepository.findBySlug(ctx.storeId, slug);
    if (exists) {
      if (!options.updateExisting) {
        result.skipped++;
        continue;
      }
      try {
        await updateProduct(ctx, exists.id, {
          shortDescription: row.shortDescription || undefined,
          description: row.description || undefined,
          price,
        });
        // أضف الصور فقط إذا لم يكن للمنتج صور بعد (تجنّب التكرار).
        const urls = (row.images ?? []).map((u) => u.trim()).filter(Boolean);
        if (urls.length > 0) {
          const [media] = await db.select({ id: productMedia.id }).from(productMedia).where(eq(productMedia.productId, exists.id)).limit(1);
          if (!media) {
            for (const u of urls) {
              try {
                await addProductImageUrl(ctx, exists.id, u);
              } catch {
                /* رابط صورة غير صالح: تجاهل */
              }
            }
          }
        }
        result.updated++;
      } catch (e) {
        result.failed++;
        if (result.errors.length < 20) result.errors.push(`${name}: ${e instanceof Error ? e.message : "خطأ"}`);
      }
      continue;
    }

    try {
      const product = await createProduct(ctx, {
        name,
        shortDescription: row.shortDescription || undefined,
        description: row.description || undefined,
        productType: mapType(row.type),
        status: (row.status ?? "").toLowerCase().includes("hidden") || (row.status ?? "").includes("مخف") ? "draft" : "active",
        variants: [{ name: "الافتراضي", price, isDefault: true }],
      });

      for (const url of row.images ?? []) {
        const u = url.trim();
        if (u) {
          try {
            await addProductImageUrl(ctx, product.id, u);
          } catch {
            /* رابط صورة غير صالح: تجاهل */
          }
        }
      }
      result.created++;
    } catch (e) {
      result.failed++;
      if (result.errors.length < 20) result.errors.push(`${name}: ${e instanceof Error ? e.message : "خطأ"}`);
    }
  }

  void db;
  return result;
}

/** يحوّل كائنات CSV إلى صفوف استيراد بمطابقة أسماء الأعمدة الشائعة (عربي/إنجليزي). */
export function mapCsvRows(objects: Record<string, string>[]): ImportRow[] {
  const pick = (o: Record<string, string>, keys: string[]) => {
    for (const k of keys) if (o[k]) return o[k];
    return undefined;
  };
  return objects.map((o) => {
    const imagesRaw = pick(o, ["images", "image", "الصور", "الصورة", "image_url", "main_image"]) ?? "";
    return {
      name: pick(o, ["name", "title", "الاسم", "اسم المنتج", "product name"]),
      price: pick(o, ["price", "السعر", "sale_price", "regular_price"]),
      description: pick(o, ["description", "الوصف", "details"]),
      shortDescription: pick(o, ["short_description", "وصف مختصر", "subtitle"]),
      type: pick(o, ["type", "النوع", "product_type"]),
      status: pick(o, ["status", "الحالة"]),
      images: imagesRaw.split(/[|,\n]+/).map((s) => s.trim()).filter(Boolean),
    };
  });
}
