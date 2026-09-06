import { getStorefrontStore } from "@/core/tenancy/server";

export default async function StorefrontHome() {
  const store = await getStorefrontStore();
  return (
    <section className="py-12 text-center sm:py-20">
      <h1 className="text-2xl font-bold sm:text-3xl">{store ? store.name : "منصة المتاجر"}</h1>
      <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
        {store ? "صفحة المتجر الرئيسية." : "لا يوجد متجر على هذا العنوان."}
      </p>
    </section>
  );
}
