import { z } from "zod";

const authSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("header"), name: z.string().min(1) }),
  z.object({ type: z.literal("bearer") }),
  z.object({ type: z.literal("query"), name: z.string().min(1) }),
]);

const endpointSchema = z.object({
  method: z.enum(["GET", "POST", "PUT"]),
  path: z.string(),
  query: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  contentType: z.enum(["json", "form"]).optional(),
});

/** مخطط قالب الاتصال؛ يُستخدم للتحقق من JSON الذي يعدّله التاجر. */
export const providerConfigSchema = z.object({
  auth: authSchema,
  headers: z.record(z.string()).optional(),
  test: endpointSchema.optional(),
  packages: endpointSchema.extend({ listPath: z.string().optional(), idField: z.string().optional(), nameField: z.string().optional() }).optional(),
  create: endpointSchema,
  result: z.object({
    okPath: z.string().optional(),
    errorPath: z.string().optional(),
    username: z.string().optional(),
    password: z.string().optional(),
    host: z.string().optional(),
    expiresAt: z.string().optional(),
    m3u: z.string().optional(),
    extra: z.record(z.string()).optional(),
  }),
  derive: z.record(z.string()).optional(),
  deliveryTemplate: z.string().min(1),
  timeoutMs: z.number().int().min(1000).max(120_000).optional(),
});

export const createProviderSchema = z.object({
  name: z.string().trim().min(1, "الاسم مطلوب").max(100),
  preset: z.enum(["shebik", "falcon", "generic"]),
  baseUrl: z.string().trim().url("رابط API غير صالح"),
  apiKey: z.string().trim().min(1, "مفتاح API مطلوب"),
  /** إن غاب يُستخدم قالب الـ preset. */
  config: providerConfigSchema.optional(),
});

export const updateProviderSchema = createProviderSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const upsertMappingSchema = z.object({
  variantId: z.string().uuid(),
  providerId: z.string().uuid(),
  packageId: z.string().trim().min(1, "معرّف الباقة مطلوب"),
  params: z.record(z.unknown()).default({}),
  isActive: z.boolean().default(true),
});

export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type UpsertMappingInput = z.infer<typeof upsertMappingSchema>;
