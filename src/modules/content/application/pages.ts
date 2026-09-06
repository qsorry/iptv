import { and, eq, desc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { pages } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, ValidationError } from "@/core/errors";
import { slugify } from "@/lib/slugify";

export async function upsertPage(ctx: StoreContext, input: { id?: string; title: string; body?: string; seoDescription?: string; status: "draft" | "published"; slug?: string }) {
  requireRole(ctx, "owner", "admin");
  if (input.title.trim().length < 2) throw new ValidationError("العنوان قصير");
  const slug = input.slug?.trim() || slugify(input.title);
  const publishedAt = input.status === "published" ? new Date() : null;

  if (input.id) {
    const [row] = await db.update(pages).set({ title: input.title, body: input.body, seoDescription: input.seoDescription, status: input.status, publishedAt, updatedAt: new Date() })
      .where(and(eq(pages.id, input.id), eq(pages.storeId, ctx.storeId))).returning();
    return row;
  }
  const dup = await db.query.pages.findFirst({ where: and(eq(pages.storeId, ctx.storeId), eq(pages.slug, slug)) });
  if (dup) throw new ConflictError("يوجد صفحة بنفس الرابط");
  const [row] = await db.insert(pages).values({ storeId: ctx.storeId, title: input.title, slug, body: input.body, seoDescription: input.seoDescription, status: input.status, publishedAt }).returning();
  return row;
}

export const listPages = (storeId: string) => db.select().from(pages).where(eq(pages.storeId, storeId)).orderBy(desc(pages.createdAt));
export const getPageById = (storeId: string, id: string) => db.query.pages.findFirst({ where: and(eq(pages.storeId, storeId), eq(pages.id, id)) });
export const getPublicPage = (storeId: string, slug: string) => db.query.pages.findFirst({ where: and(eq(pages.storeId, storeId), eq(pages.slug, slug), eq(pages.status, "published")) });
export const listFooterPages = (storeId: string) => db.select({ title: pages.title, slug: pages.slug }).from(pages).where(and(eq(pages.storeId, storeId), eq(pages.status, "published")));

export async function deletePage(ctx: StoreContext, id: string) {
  requireRole(ctx, "owner", "admin");
  await db.delete(pages).where(and(eq(pages.id, id), eq(pages.storeId, ctx.storeId)));
}
