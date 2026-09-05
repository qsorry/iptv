import { z } from "zod";

const slug = z.string().min(1).max(160).regex(/^[a-z0-9؀-ۿ]+(?:-[a-z0-9؀-ۿ]+)*$/, "slug غير صالح");
const price = z.string().regex(/^\d+(\.\d{1,2})?$/, "السعر يجب أن يكون رقماً بخانتين عشريتين كحد أقصى");

export const variantInputSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  price,
  compareAtPrice: price.optional(),
  costPrice: price.optional(),
  isDefault: z.boolean().default(false),
});

export const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  slug: slug.optional(),
  categoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  shortDescription: z.string().max(500).optional(),
  description: z.string().optional(),
  productType: z.enum(["physical", "digital", "service"]).default("physical"),
  status: z.enum(["draft", "active"]).default("draft"),
  variants: z.array(variantInputSchema).min(1, "يجب وجود variant واحد على الأقل"),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type VariantInput = z.infer<typeof variantInputSchema>;
