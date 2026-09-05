import { ForbiddenError } from "@/core/errors";

/** سياق المستأجر الذي تمرره كل حالة استخدام. لا استعلام تجاري بدون store_id. */
export interface StoreContext {
  storeId: string;
  userId?: string;
  role?: "owner" | "admin" | "staff";
}

export function requireRole(ctx: StoreContext, ...roles: NonNullable<StoreContext["role"]>[]) {
  if (!ctx.role || !roles.includes(ctx.role)) throw new ForbiddenError();
}
