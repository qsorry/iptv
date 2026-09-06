import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET يجب أن يكون 32 حرفاً على الأقل"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  /** الدومين الرئيسي للمنصة؛ المتاجر تعمل على subdomains تحته (store.platform.com). */
  PLATFORM_DOMAIN: z.string().default("localhost:3000"),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  /** الرابط العام للملفات (CDN أو الـ bucket نفسه). */
  S3_PUBLIC_URL: z.string().url().optional(),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  PLATFORM_DOMAIN: process.env.PLATFORM_DOMAIN,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_BUCKET: process.env.S3_BUCKET,
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
  S3_PUBLIC_URL: process.env.S3_PUBLIC_URL,
});
