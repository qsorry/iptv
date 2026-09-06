import { getAdminContext } from "@/core/tenancy/server";

export default async function DashboardPage() {
  const ctx = await getAdminContext();
  return (
    <div>
      <h1 className="text-2xl font-semibold">{ctx.storeName}</h1>
      <p className="mt-2 text-gray-600">دورك: {ctx.role}. بطاقات الإحصائيات تُضاف هنا.</p>
    </div>
  );
}
