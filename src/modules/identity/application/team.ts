import { and, eq, ne } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { storeMembers, users } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ConflictError, NotFoundError, ValidationError } from "@/core/errors";

export function listMembers(storeId: string) {
  return db
    .select({ id: storeMembers.id, userId: storeMembers.userId, role: storeMembers.role, status: storeMembers.status, name: users.name, email: users.email })
    .from(storeMembers)
    .innerJoin(users, eq(users.id, storeMembers.userId))
    .where(eq(storeMembers.storeId, storeId));
}

/** يضيف مستخدماً مسجّلاً (بالبريد) عضواً في المتجر. */
export async function addMember(ctx: StoreContext, email: string, role: "admin" | "staff") {
  requireRole(ctx, "owner", "admin");
  const user = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) });
  if (!user) throw new NotFoundError("لا يوجد مستخدم بهذا البريد. يجب أن ينشئ حساباً أولاً");
  const existing = await db.query.storeMembers.findFirst({ where: and(eq(storeMembers.storeId, ctx.storeId), eq(storeMembers.userId, user.id)) });
  if (existing) throw new ConflictError("العضو مضاف مسبقاً");
  const [row] = await db.insert(storeMembers).values({ storeId: ctx.storeId, userId: user.id, role }).returning();
  return row;
}

export async function updateMemberRole(ctx: StoreContext, memberId: string, role: "owner" | "admin" | "staff") {
  requireRole(ctx, "owner");
  await db.update(storeMembers).set({ role, updatedAt: new Date() }).where(and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, ctx.storeId)));
}

export async function removeMember(ctx: StoreContext, memberId: string) {
  requireRole(ctx, "owner", "admin");
  const member = await db.query.storeMembers.findFirst({ where: and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, ctx.storeId)) });
  if (!member) throw new NotFoundError("العضو", memberId);
  if (member.role === "owner") {
    const owners = await db.select({ id: storeMembers.id }).from(storeMembers).where(and(eq(storeMembers.storeId, ctx.storeId), eq(storeMembers.role, "owner")));
    if (owners.length <= 1) throw new ValidationError("لا يمكن حذف المالك الوحيد");
  }
  await db.delete(storeMembers).where(and(eq(storeMembers.id, memberId), eq(storeMembers.storeId, ctx.storeId), ne(storeMembers.userId, ctx.userId ?? "")));
}
