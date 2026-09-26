import { getAdminContext } from "@/core/tenancy/server";
import { PLATFORM_TZ } from "@/lib/dates";
import { AppError } from "@/core/errors";
import { isPlatformAdmin, requirePlatformAdmin } from "@/modules/billing";
import type { Actor, ItemState } from "@/modules/providers";
import type { ProviderStatus } from "@/core/state-machines";
import type { BadgeVariant } from "@/design-system/variants";
import { PageHeader } from "@/components/admin/page-header";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";

export const selectClass = "w-full rounded-input border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2.5 text-base text-ink";

/** سياق مدير المنصة للصفحة، أو null لغيره. */
export async function platformContext() {
  const ctx = await getAdminContext();
  return isPlatformAdmin(ctx.userEmail) ? ctx : null;
}

/** للاستخدام داخل server actions: يرمي ForbiddenError لغير مدير المنصة. */
export async function requireActor(): Promise<Actor> {
  const ctx = await getAdminContext();
  requirePlatformAdmin(ctx.userEmail);
  return { userId: ctx.userId ?? null, email: ctx.userEmail };
}

export function errorMessage(e: unknown, fallback: string) {
  return e instanceof AppError ? e.message : fallback;
}

export function withFlash(path: string, error: string | null, ok: string) {
  return error ? `${path}?error=${encodeURIComponent(error)}` : `${path}?ok=${encodeURIComponent(ok)}`;
}

export const STATUS_VARIANT: Record<ProviderStatus, BadgeVariant> = {
  pending: "default",
  under_review: "warning",
  approved: "success",
  rejected: "error",
  suspended: "error",
};

export const ITEM_VARIANT: Record<ItemState, BadgeVariant> = {
  ok: "success",
  submitted: "warning",
  missing: "default",
  rejected: "error",
  expired: "error",
  no_expiry: "error",
};

export function PlatformDenied({ title }: { title: string }) {
  return (
    <div className="max-w-2xl">
      <PageHeader title={title} />
      <Card>
        <p className="text-sm">هذه الصفحة لمديري المنصة فقط.</p>
      </Card>
    </div>
  );
}

export function Flash({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <Alert variant="error">{error}</Alert>;
  if (ok) return <Alert variant="success">{ok}</Alert>;
  return null;
}

export function formatDate(d: Date | null | undefined) {
  return d ? d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric", timeZone: PLATFORM_TZ }) : "—";
}
