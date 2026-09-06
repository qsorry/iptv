import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { stores, storeSettings, storeMembers, warehouses } from "@/infrastructure/database/schema";
import { ValidationError } from "@/core/errors";
import { subdomainize, isReservedSubdomain, randomSubdomain } from "@/lib/subdomain";

export const createStoreSchema = z.object({
  name: z.string().min(2).max(120),
  currencyCode: z.string().length(3).default("SAR"),
  ownerUserId: z.string().uuid(),
});

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base && !isReservedSubdomain(base) ? base : randomSubdomain();
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.stores.findFirst({ where: eq(stores.slug, candidate) });
    if (!existing) return candidate;
    candidate = `${base || "store"}-${Math.random().toString(36).slice(2, 5)}`;
  }
  return randomSubdomain();
}

/** تهيئة متجر جديد: المتجر + الإعدادات + المالك + مستودع افتراضي. الـ slug هو الـ subdomain. */
export async function createStore(rawInput: z.input<typeof createStoreSchema>) {
  const parsed = createStoreSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const input = parsed.data;

  const slug = await uniqueSlug(subdomainize(input.name));

  return db.transaction(async (tx) => {
    const [store] = await tx.insert(stores).values({ name: input.name, slug, currencyCode: input.currencyCode }).returning();
    await tx.insert(storeSettings).values({ storeId: store.id });
    await tx.insert(storeMembers).values({ storeId: store.id, userId: input.ownerUserId, role: "owner" });
    await tx.insert(warehouses).values({ storeId: store.id, name: "المستودع الرئيسي", code: "main", isDefault: true });
    return store;
  });
}
