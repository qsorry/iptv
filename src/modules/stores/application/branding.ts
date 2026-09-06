import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { stores } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ValidationError } from "@/core/errors";

export const brandingSchema = z.object({
  name: z.string().min(2).max(120),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح (مثل #004d73)"),
  logoUrl: z.string().url().optional().or(z.literal("")),
  description: z.string().max(300).optional(),
});

export async function updateBranding(ctx: StoreContext, raw: z.input<typeof brandingSchema>) {
  requireRole(ctx, "owner", "admin");
  const parsed = brandingSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(undefined, parsed.error.flatten());
  const input = parsed.data;
  await db
    .update(stores)
    .set({ name: input.name, brandColor: input.brandColor, logoUrl: input.logoUrl || null, description: input.description || null, updatedAt: new Date() })
    .where(eq(stores.id, ctx.storeId));
}
