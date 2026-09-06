import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { subscriptionMappings, productVariants } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";
import { requireSubscriptionsApi } from "./access";
import { subscriptionRepository } from "../infrastructure/subscription.repository";
import { upsertMappingSchema, type UpsertMappingInput } from "../validations";

export async function listMappings(ctx: StoreContext) {
  return subscriptionRepository.listMappings(ctx.storeId);
}

/** ربط variant بمزوّد وباقة. الـ variant الواحد يرتبط بمزوّد واحد فقط (upsert). */
export async function upsertMapping(ctx: StoreContext, raw: UpsertMappingInput) {
  await requireSubscriptionsApi(ctx);
  const parsed = upsertMappingSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message, parsed.error.flatten());
  const input = parsed.data;

  const variant = await db.query.productVariants.findFirst({ where: and(eq(productVariants.id, input.variantId), eq(productVariants.storeId, ctx.storeId)) });
  if (!variant) throw new NotFoundError("المتغيّر", input.variantId);
  const provider = await subscriptionRepository.findProvider(ctx.storeId, input.providerId);
  if (!provider) throw new NotFoundError("المزوّد", input.providerId);

  const [row] = await db
    .insert(subscriptionMappings)
    .values({ storeId: ctx.storeId, variantId: input.variantId, providerId: input.providerId, packageId: input.packageId, params: input.params, isActive: input.isActive })
    .onConflictDoUpdate({
      target: subscriptionMappings.variantId,
      set: { providerId: input.providerId, packageId: input.packageId, params: input.params, isActive: input.isActive, updatedAt: new Date() },
    })
    .returning();
  return row;
}

export async function deleteMapping(ctx: StoreContext, id: string) {
  await requireSubscriptionsApi(ctx);
  const deleted = await db
    .delete(subscriptionMappings)
    .where(and(eq(subscriptionMappings.id, id), eq(subscriptionMappings.storeId, ctx.storeId)))
    .returning({ id: subscriptionMappings.id });
  if (deleted.length === 0) throw new NotFoundError("الربط", id);
}
