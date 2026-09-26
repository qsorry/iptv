import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { providerRequirements } from "@/infrastructure/database/schema";
import { NotFoundError } from "@/core/errors";
import { parseInput as parse, requirementSchema, updateRequirementSchema } from "../validations";
import type { RequirementKind } from "../domain/labels";

/**
 * الشروط الافتراضية. تُضاف مرة واحدة حسب `code` ولا تُكتب فوق تعديلات مدير المنصة.
 * الشروط لا تُحذف (تُعطَّل فقط) حتى يبقى سجل المراجعات السابقة.
 */
export const DEFAULT_REQUIREMENTS: {
  code: string;
  title: string;
  description: string;
  kind: RequirementKind;
  isRequired: boolean;
  hasExpiry: boolean;
  sortOrder: number;
}[] = [
  { code: "cr", title: "سجل تجاري ساري", description: "صورة السجل التجاري ورقمه، ساري المفعول.", kind: "document", isRequired: true, hasExpiry: true, sortOrder: 10 },
  {
    code: "media_license",
    title: "ترخيص هيئة الإعلام المرئي والمسموع",
    description: "مطلوب إذا كان المزوّد يقدّم خدمته في السعودية.",
    kind: "document",
    isRequired: true,
    hasExpiry: true,
    sortOrder: 20,
  },
  {
    code: "distribution_rights",
    title: "عقود توزيع من أصحاب المحتوى",
    description: "لكل قناة أو مكتبة، تغطي منطقة البث وتذكر تاريخ الانتهاء. يُسجَّل أقرب تاريخ انتهاء بينها.",
    kind: "document",
    isRequired: true,
    hasExpiry: true,
    sortOrder: 30,
  },
  {
    code: "ownership_proof",
    title: "إثبات ملكية المحتوى الخاص",
    description: "إن كان جزء من المحتوى من إنتاج المزوّد نفسه.",
    kind: "document",
    isRequired: false,
    hasExpiry: false,
    sortOrder: 35,
  },
  {
    code: "content_list",
    title: "قائمة القنوات والمحتوى مربوطة بالعقود",
    description: "كل عنصر في القائمة يقابله عقد يغطيه، وأي عنصر بلا عقد يُرفض.",
    kind: "document",
    isRequired: true,
    hasExpiry: false,
    sortOrder: 40,
  },
  {
    code: "rights_verified",
    title: "تحقق مباشر من صاحب الحقوق",
    description: "تأكيد العقود بالتواصل مع قسم الحقوق لدى صاحب المحتوى، لا الاكتفاء بملف PDF.",
    kind: "verification",
    isRequired: true,
    hasExpiry: false,
    sortOrder: 50,
  },
  {
    code: "test_account",
    title: "حساب تجريبي مطابق للقائمة",
    description: "تجربة البث والتأكد أنه يطابق القائمة المقدّمة.",
    kind: "verification",
    isRequired: true,
    hasExpiry: false,
    sortOrder: 60,
  },
  {
    code: "platform_contract",
    title: "توقيع عقد المنصة",
    description: "يشمل إقرار ملكية الحقوق، والإيقاف الفوري عند الشكوى، وحق التدقيق الدوري.",
    kind: "contract",
    isRequired: true,
    hasExpiry: false,
    sortOrder: 70,
  },
];

/** يضمن وجود الشروط الافتراضية (idempotent). */
export async function ensureDefaultRequirements() {
  await db.insert(providerRequirements).values(DEFAULT_REQUIREMENTS).onConflictDoNothing({ target: providerRequirements.code });
}

export async function listRequirements(opts: { activeOnly?: boolean } = {}) {
  return db.query.providerRequirements.findMany({
    where: opts.activeOnly ? eq(providerRequirements.isActive, true) : undefined,
    orderBy: [asc(providerRequirements.sortOrder), asc(providerRequirements.createdAt)],
  });
}

export async function createRequirement(input: unknown) {
  const data = parse(requirementSchema, input);
  const [row] = await db
    .insert(providerRequirements)
    .values({ ...data, code: `custom_${randomUUID().slice(0, 8)}` })
    .returning();
  return row;
}

export async function updateRequirement(id: string, input: unknown) {
  const data = parse(updateRequirementSchema, input);
  const [row] = await db
    .update(providerRequirements)
    .set({ ...data, description: data.description ?? null, updatedAt: new Date() })
    .where(eq(providerRequirements.id, id))
    .returning();
  if (!row) throw new NotFoundError("الشرط", id);
  return row;
}
