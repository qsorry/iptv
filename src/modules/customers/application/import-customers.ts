import { and, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { customers } from "@/infrastructure/database/schema";
import type { StoreContext } from "@/core/tenancy";
import { requireRole } from "@/core/tenancy";

export interface CustomerImportRow {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface CustomerImportResult {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const cleanEmail = (v?: string) => {
  const e = (v ?? "").trim().toLowerCase();
  return e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : undefined;
};

/** يوحّد رقم الجوال إلى صيغة دولية بسيطة (أرقام مع + اختيارية). */
const cleanPhone = (v?: string) => {
  let p = (v ?? "").trim().replace(/[\s\-()]/g, "");
  if (!p) return undefined;
  const plus = p.startsWith("+");
  p = p.replace(/[^\d]/g, "");
  if (!p) return undefined;
  return (plus ? "+" : "") + p;
};

/**
 * استيراد العملاء (من تصدير سلة أو غيره). يطابق بالبريد أولاً ثم الجوال،
 * فيحدّث الموجود ويضيف الجديد. يتخطّى الصفوف بلا بريد ولا جوال.
 */
export async function importCustomers(ctx: StoreContext, rows: CustomerImportRow[]): Promise<CustomerImportResult> {
  requireRole(ctx, "owner", "admin");
  const result: CustomerImportResult = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] };

  for (const row of rows) {
    const email = cleanEmail(row.email);
    const phone = cleanPhone(row.phone);
    const firstName = (row.firstName ?? "").trim() || undefined;
    const lastName = (row.lastName ?? "").trim() || undefined;

    if (!email && !phone) {
      result.skipped++;
      continue;
    }

    try {
      // ابحث عن عميل موجود بالبريد ثم بالجوال.
      let existing = email
        ? await db.query.customers.findFirst({ where: and(eq(customers.storeId, ctx.storeId), eq(customers.email, email)) })
        : undefined;
      if (!existing && phone) {
        existing = await db.query.customers.findFirst({ where: and(eq(customers.storeId, ctx.storeId), eq(customers.phone, phone)) });
      }

      if (existing) {
        await db
          .update(customers)
          .set({
            email: existing.email ?? email,
            phone: existing.phone ?? phone,
            firstName: firstName ?? existing.firstName,
            lastName: lastName ?? existing.lastName,
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existing.id));
        result.updated++;
      } else {
        await db.insert(customers).values({ storeId: ctx.storeId, email, phone, firstName, lastName });
        result.created++;
      }
    } catch (e) {
      result.failed++;
      if (result.errors.length < 20) result.errors.push(`${email ?? phone}: ${e instanceof Error ? e.message : "خطأ"}`);
    }
  }

  return result;
}

/** يحوّل كائنات CSV إلى صفوف عملاء بمطابقة أسماء الأعمدة الشائعة (عربي/إنجليزي/تصدير سلة). */
export function mapCustomerCsvRows(objects: Record<string, string>[]): CustomerImportRow[] {
  const pick = (o: Record<string, string>, keys: string[]) => {
    for (const k of keys) {
      const hit = Object.keys(o).find((ok) => ok.trim().toLowerCase() === k.toLowerCase());
      if (hit && o[hit]) return o[hit];
    }
    return undefined;
  };
  return objects.map((o) => {
    const full = pick(o, ["full_name", "name", "الاسم", "اسم العميل", "الاسم الكامل", "customer name"]);
    let firstName = pick(o, ["first_name", "firstname", "الاسم الأول"]);
    let lastName = pick(o, ["last_name", "lastname", "اسم العائلة", "الاسم الأخير"]);
    if (!firstName && full) {
      const parts = full.trim().split(/\s+/);
      firstName = parts.shift();
      lastName = lastName ?? (parts.length ? parts.join(" ") : undefined);
    }
    // الجوال: قد يأتي مع رمز دولة منفصل (تصدير سلة: mobile + mobile_code).
    const mobile = pick(o, ["phone", "mobile", "الجوال", "الهاتف", "رقم الجوال", "mobile_number"]);
    const code = pick(o, ["mobile_code", "country_code", "رمز الدولة"]);
    let phone = mobile;
    if (mobile && code && !mobile.startsWith("+") && !mobile.startsWith(code.replace("+", ""))) {
      phone = `${code}${mobile}`;
    }
    return {
      firstName,
      lastName,
      email: pick(o, ["email", "البريد", "البريد الإلكتروني", "e-mail"]),
      phone,
    };
  });
}
