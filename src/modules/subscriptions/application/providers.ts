import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { subscriptionProviders } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { NotFoundError, ValidationError } from "@/core/errors";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto";
import { HttpSubscriptionProvider, PRESETS, type ProviderConfig } from "@/infrastructure/integrations/subscriptions";
import { requireSubscriptionsApi } from "./access";
import { subscriptionRepository } from "../infrastructure/subscription.repository";
import { createProviderSchema, updateProviderSchema, providerConfigSchema, type CreateProviderInput, type UpdateProviderInput } from "../validations";

type ProviderRow = typeof subscriptionProviders.$inferSelect;

/** يبني عميل HTTP من صف المزوّد (يفك تشفير المفتاح). للاستخدام الداخلي في الخادم فقط. */
export function buildClient(row: ProviderRow) {
  const config = providerConfigSchema.parse(row.config) as ProviderConfig;
  return new HttpSubscriptionProvider(row.baseUrl, decryptSecret(row.apiKeyEncrypted), config);
}

/** يُخفي المفتاح للعرض. */
export function presentProvider(row: ProviderRow) {
  const { apiKeyEncrypted, ...rest } = row;
  let apiKeyMasked = "••••";
  try {
    apiKeyMasked = maskSecret(decryptSecret(apiKeyEncrypted));
  } catch {
    /* مفتاح تالف: يُعرض مقنّعاً */
  }
  return { ...rest, apiKeyMasked };
}

export async function listProviders(ctx: StoreContext) {
  const rows = await subscriptionRepository.listProviders(ctx.storeId);
  return rows.map(presentProvider);
}

export async function createProvider(ctx: StoreContext, raw: CreateProviderInput) {
  await requireSubscriptionsApi(ctx);
  const parsed = createProviderSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message, parsed.error.flatten());
  const input = parsed.data;
  const config = input.config ?? PRESETS[input.preset].config;

  const [row] = await db
    .insert(subscriptionProviders)
    .values({
      storeId: ctx.storeId,
      name: input.name,
      preset: input.preset,
      baseUrl: input.baseUrl,
      apiKeyEncrypted: encryptSecret(input.apiKey),
      config: config as unknown as Record<string, unknown>,
    })
    .returning();
  return presentProvider(row);
}

export async function updateProvider(ctx: StoreContext, id: string, raw: UpdateProviderInput) {
  await requireSubscriptionsApi(ctx);
  const parsed = updateProviderSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message, parsed.error.flatten());
  const existing = await subscriptionRepository.findProvider(ctx.storeId, id);
  if (!existing) throw new NotFoundError("المزوّد", id);

  const input = parsed.data;
  const [row] = await db
    .update(subscriptionProviders)
    .set({
      name: input.name ?? existing.name,
      preset: input.preset ?? existing.preset,
      baseUrl: input.baseUrl ?? existing.baseUrl,
      apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey) : existing.apiKeyEncrypted,
      config: input.config ? (input.config as unknown as Record<string, unknown>) : existing.config,
      isActive: input.isActive ?? existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(subscriptionProviders.id, id))
    .returning();
  return presentProvider(row);
}

export async function deleteProvider(ctx: StoreContext, id: string) {
  await requireSubscriptionsApi(ctx);
  const existing = await subscriptionRepository.findProvider(ctx.storeId, id);
  if (!existing) throw new NotFoundError("المزوّد", id);
  await db.delete(subscriptionProviders).where(eq(subscriptionProviders.id, id));
}

/** يختبر الاتصال ويسجّل النتيجة على المزوّد. */
export async function testProvider(ctx: StoreContext, id: string) {
  await requireSubscriptionsApi(ctx);
  const row = await subscriptionRepository.findProvider(ctx.storeId, id);
  if (!row) throw new NotFoundError("المزوّد", id);
  const result = await buildClient(row).test();
  await db
    .update(subscriptionProviders)
    .set({ lastTestedAt: new Date(), lastError: result.ok ? null : result.message, updatedAt: new Date() })
    .where(eq(subscriptionProviders.id, id));
  return result;
}

/** قائمة الباقات من المزوّد (إن كان القالب يعرّف نداء packages). */
export async function listProviderPackages(ctx: StoreContext, id: string) {
  await requireSubscriptionsApi(ctx);
  const row = await subscriptionRepository.findProvider(ctx.storeId, id);
  if (!row) throw new NotFoundError("المزوّد", id);
  return buildClient(row).listPackages();
}
