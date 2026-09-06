import { and, eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/infrastructure/database/client";
import { storeMembers } from "@/infrastructure/database/schema";
import { auth } from "@/lib/auth";
import type { StoreContext } from "@/core/tenancy";
import { ForbiddenError } from "@/core/errors";

/**
 * سياق المتجر لمسارات api/v1 المحمية: جلسة Better Auth (كوكي أو bearer) + هيدر x-store-id
 * يجب أن يملك المستخدم عضوية نشطة في المتجر. تطبيق الجوال يستهلك نفس المسار.
 */
export async function requireApiStoreContext(request: NextRequest): Promise<StoreContext> {
  const storeId = request.headers.get("x-store-id");
  if (!storeId) throw new ForbiddenError("x-store-id مطلوب");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new ForbiddenError("يلزم تسجيل الدخول");
  const member = await db.query.storeMembers.findFirst({
    where: and(eq(storeMembers.storeId, storeId), eq(storeMembers.userId, session.user.id), eq(storeMembers.status, "active")),
  });
  if (!member) throw new ForbiddenError();
  return { storeId, userId: session.user.id, role: member.role };
}
