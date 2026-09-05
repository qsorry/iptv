import { uuid, timestamp, numeric, char } from "drizzle-orm/pg-core";

/** مفتاح أساسي UUID موحّد لكل الجداول. */
export const id = () => uuid("id").primaryKey().defaultRandom();

/** أعمدة created_at / updated_at. */
export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/** مبلغ مالي. يُخزَّن كـ numeric(12,2)؛ لا نستخدم float أبداً للمال. */
export const money = (name: string) => numeric(name, { precision: 12, scale: 2 });

/** رمز عملة ISO 4217. */
export const currencyCode = (name = "currency_code") => char(name, { length: 3 });
