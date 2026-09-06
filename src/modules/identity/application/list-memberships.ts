import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { storeMembers, stores } from "@/infrastructure/database/schema";

/** المتاجر التي يملك المستخدم عضوية نشطة فيها. */
export async function listMemberships(userId: string) {
  return db
    .select({ storeId: storeMembers.storeId, role: storeMembers.role, storeName: stores.name, storeSlug: stores.slug })
    .from(storeMembers)
    .innerJoin(stores, eq(stores.id, storeMembers.storeId))
    .where(and(eq(storeMembers.userId, userId), eq(storeMembers.status, "active")));
}
