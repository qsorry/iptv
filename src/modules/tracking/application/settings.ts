import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { integrationSettings } from "@/infrastructure/database/schema";
import type { DbExecutor } from "@/infrastructure/database/client";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";
import { ValidationError } from "@/core/errors";
import { PLATFORM_DEFS, PLATFORMS, isPlatform, type Platform } from "../domain/platforms";
import { decryptSecret, encryptSecret, maskSecret } from "../infrastructure/crypto";

export interface IntegrationView {
  platform: Platform;
  enabled: boolean;
  config: Record<string, string>;
  /** أسرار مقنّعة فقط — القيمة الحقيقية لا تغادر الخادم. */
  maskedSecrets: Record<string, string>;
}

export interface IntegrationRuntime {
  platform: Platform;
  enabled: boolean;
  config: Record<string, string>;
  secrets: Record<string, string>;
}

/** إعدادات المتجر كما تعرضها لوحة التحكم (بلا أسرار صريحة). */
export async function listIntegrations(storeId: string): Promise<IntegrationView[]> {
  const rows = await db.select().from(integrationSettings).where(eq(integrationSettings.storeId, storeId));
  const byPlatform = new Map(rows.map((r) => [r.platform, r]));
  return PLATFORMS.map((platform) => {
    const row = byPlatform.get(platform);
    const masked: Record<string, string> = {};
    for (const field of PLATFORM_DEFS[platform].secrets) {
      const stored = row?.secrets?.[field.name];
      masked[field.name] = stored ? safeMask(stored) : "";
    }
    return {
      platform,
      enabled: row?.enabled ?? false,
      config: (row?.config ?? {}) as Record<string, string>,
      maskedSecrets: masked,
    };
  });
}

function safeMask(stored: string): string {
  try {
    return maskSecret(decryptSecret(stored));
  } catch {
    return "••••";
  }
}

/** الإعدادات الفعلية للإرسال. تُستدعى من العامل فقط. */
export async function runtimeIntegrations(executor: DbExecutor, storeId: string): Promise<IntegrationRuntime[]> {
  const rows = await executor.select().from(integrationSettings).where(eq(integrationSettings.storeId, storeId));
  return rows.filter((r) => isPlatform(r.platform)).map((row) => {
    const secrets: Record<string, string> = {};
    for (const [k, v] of Object.entries(row.secrets ?? {})) {
      try {
        secrets[k] = decryptSecret(v);
      } catch {
        // سر تالف أو مفتاح تغيّر: نتجاهله بدل إسقاط الدفعة كلها.
      }
    }
    return { platform: row.platform as Platform, enabled: row.enabled, config: (row.config ?? {}) as Record<string, string>, secrets };
  });
}

/** الإعدادات العامة التي يحتاجها المتصفح (معرّفات البكسل فقط، بلا أي سر). */
export async function publicIntegrations(storeId: string): Promise<Partial<Record<Platform, Record<string, string>>>> {
  const rows = await db.select().from(integrationSettings).where(eq(integrationSettings.storeId, storeId));
  const out: Partial<Record<Platform, Record<string, string>>> = {};
  for (const row of rows) {
    if (!row.enabled || !isPlatform(row.platform)) continue;
    out[row.platform] = (row.config ?? {}) as Record<string, string>;
  }
  return out;
}

export interface SaveIntegrationInput {
  platform: string;
  enabled: boolean;
  config: Record<string, string>;
  /** سر فارغ = أبقِ القيمة المخزّنة كما هي (الواجهة ترى قناعاً لا قيمة). */
  secrets: Record<string, string>;
}

export async function saveIntegration(ctx: StoreContext, input: SaveIntegrationInput) {
  requireRole(ctx, "owner", "admin");
  if (!isPlatform(input.platform)) throw new ValidationError("منصة غير معروفة", { platform: input.platform });
  const def = PLATFORM_DEFS[input.platform];

  const existing = await db.query.integrationSettings.findFirst({
    where: and(eq(integrationSettings.storeId, ctx.storeId), eq(integrationSettings.platform, input.platform)),
  });

  const config: Record<string, string> = {};
  for (const field of def.config) {
    const value = (input.config[field.name] ?? "").trim();
    if (value) config[field.name] = value.slice(0, 200);
  }

  const secrets: Record<string, string> = { ...(existing?.secrets ?? {}) };
  for (const field of def.secrets) {
    const value = (input.secrets[field.name] ?? "").trim();
    if (value) secrets[field.name] = encryptSecret(value.slice(0, 500));
  }

  const missingConfig = def.config.length > 0 && Object.keys(config).length === 0;
  const missingSecret = def.secrets.some((f) => !secrets[f.name]);
  if (input.enabled && (missingConfig || missingSecret)) {
    throw new ValidationError("لا يمكن تفعيل التكامل قبل إكمال بياناته");
  }

  if (existing) {
    await db
      .update(integrationSettings)
      .set({ enabled: input.enabled, config, secrets, updatedAt: new Date() })
      .where(eq(integrationSettings.id, existing.id));
    return;
  }
  await db.insert(integrationSettings).values({ storeId: ctx.storeId, platform: input.platform, enabled: input.enabled, config, secrets });
}
