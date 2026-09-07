import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { storeSettings } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ValidationError } from "@/core/errors";
import { seoSettingsSchema } from "../seo";
import type { z } from "zod";

export async function updateSeoSettings(ctx: StoreContext, raw: z.input<typeof seoSettingsSchema>) {
  requireRole(ctx, "owner", "admin");
  const parsed = seoSettingsSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("العنوان أو الوصف أطول من الحد المسموح", parsed.error.flatten());
  const row = await db.query.storeSettings.findFirst({ where: eq(storeSettings.storeId, ctx.storeId) });
  const merged = { ...((row?.settings as Record<string, unknown>) ?? {}), seo: parsed.data };
  if (row) {
    await db.update(storeSettings).set({ settings: merged, updatedAt: new Date() }).where(eq(storeSettings.storeId, ctx.storeId));
  } else {
    await db.insert(storeSettings).values({ storeId: ctx.storeId, settings: merged });
  }
  return parsed.data;
}
