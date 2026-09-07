import { and, eq, desc } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { posts } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, ValidationError } from "@/core/errors";
import { slugify } from "@/lib/slugify";

export async function upsertPost(ctx: StoreContext, input: { id?: string; title: string; excerpt?: string; body?: string; coverImage?: string; seoDescription?: string; status: "draft" | "published" }) {
  requireRole(ctx, "owner", "admin", "staff");
  if (input.title.trim().length < 2) throw new ValidationError("العنوان قصير");
  const slug = slugify(input.title);
  const publishedAt = input.status === "published" ? new Date() : null;

  if (input.id) {
    const [row] = await db.update(posts).set({ title: input.title, excerpt: input.excerpt, body: input.body, coverImage: input.coverImage, seoDescription: input.seoDescription, status: input.status, publishedAt, updatedAt: new Date() })
      .where(and(eq(posts.id, input.id), eq(posts.storeId, ctx.storeId))).returning();
    return row;
  }
  const dup = await db.query.posts.findFirst({ where: and(eq(posts.storeId, ctx.storeId), eq(posts.slug, slug)) });
  if (dup) throw new ConflictError("يوجد مقال بنفس الرابط");
  const [row] = await db.insert(posts).values({ storeId: ctx.storeId, title: input.title, slug, excerpt: input.excerpt, body: input.body, coverImage: input.coverImage, seoDescription: input.seoDescription, status: input.status, publishedAt }).returning();
  return row;
}

export const listPosts = (storeId: string) => db.select().from(posts).where(eq(posts.storeId, storeId)).orderBy(desc(posts.createdAt));
export const getPostById = (storeId: string, id: string) => db.query.posts.findFirst({ where: and(eq(posts.storeId, storeId), eq(posts.id, id)) });
export const getPublicPost = (storeId: string, slug: string) => db.query.posts.findFirst({ where: and(eq(posts.storeId, storeId), eq(posts.slug, slug), eq(posts.status, "published")) });
export const listPublishedPosts = (storeId: string) =>
  db.select({ title: posts.title, slug: posts.slug, excerpt: posts.excerpt, coverImage: posts.coverImage, publishedAt: posts.publishedAt, updatedAt: posts.updatedAt })
    .from(posts).where(and(eq(posts.storeId, storeId), eq(posts.status, "published"))).orderBy(desc(posts.publishedAt));

export async function deletePost(ctx: StoreContext, id: string) {
  requireRole(ctx, "owner", "admin", "staff");
  await db.delete(posts).where(and(eq(posts.id, id), eq(posts.storeId, ctx.storeId)));
}
