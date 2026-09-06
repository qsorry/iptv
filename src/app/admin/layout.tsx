import { requireSession } from "@/core/tenancy/server";
import { listMemberships } from "@/modules/identity";
import { sidebarBadges } from "@/modules/reports";
import { db } from "@/infrastructure/database/client";
import { stores } from "@/infrastructure/database/schema";
import { eq } from "drizzle-orm";
import { AdminShell } from "@/components/admin/admin-shell";

const PLATFORM_DOMAIN = process.env.PLATFORM_DOMAIN ?? "localhost:3000";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const memberships = await listMemberships(session.user.id);
  const active = memberships[0];
  const scheme = PLATFORM_DOMAIN.includes("localhost") ? "http" : "https";
  const storeUrl = active ? `${scheme}://${active.storeSlug}.${PLATFORM_DOMAIN}` : "#";

  let logoUrl: string | null = null;
  let storeName = active?.storeName ?? "متجري";
  if (active) {
    const store = await db.query.stores.findFirst({ where: eq(stores.id, active.storeId) });
    logoUrl = store?.logoUrl ?? null;
    storeName = store?.name ?? storeName;
  }
  const badges = active ? await sidebarBadges(active.storeId) : { pendingOrders: 0, pendingReviews: 0 };

  return (
    <AdminShell storeName={storeName} logoUrl={logoUrl} email={session.user.email} storeUrl={storeUrl} badges={badges}>
      {children}
    </AdminShell>
  );
}
