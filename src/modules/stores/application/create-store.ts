import { z } from "zod";
import { db } from "@/infrastructure/database/client";
import { stores, storeSettings, storeMembers, warehouses } from "@/infrastructure/database/schema";
import { ValidationError } from "@/core/errors";
import { slugify } from "@/lib/slugify";

export const createStoreSchema = z.object({
  name: z.string().min(2).max(120),
  slug: z.string().min(2).max(60).optional(),
  currencyCode: z.string().length(3).default("SAR"),
  ownerUserId: z.string().uuid(),
});

/** تهيئة متجر جديد: المتجر + الإعدادات + المالك + مستودع افتراضي. */
export async function createStore(rawInput: z.input<typeof createStoreSchema>) {
  const parsed = createStoreSchema.safeParse(rawInput);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const input = parsed.data;

  return db.transaction(async (tx) => {
    const [store] = await tx
      .insert(stores)
      .values({ name: input.name, slug: input.slug ?? slugify(input.name), currencyCode: input.currencyCode })
      .returning();

    await tx.insert(storeSettings).values({ storeId: store.id });
    await tx.insert(storeMembers).values({ storeId: store.id, userId: input.ownerUserId, role: "owner" });
    await tx.insert(warehouses).values({ storeId: store.id, name: "المستودع الرئيسي", code: "main", isDefault: true });

    return store;
  });
}
