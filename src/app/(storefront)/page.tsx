import { getStorefrontStore } from "@/core/tenancy/server";

export default async function StorefrontHome() {
  const store = await getStorefrontStore();
  if (!store) {
    return (
      <section className="py-16 text-center">
        <h1 className="text-3xl font-bold">منصة المتاجر</h1>
        <p className="mt-2 text-gray-600">لا يوجد متجر على هذا العنوان.</p>
      </section>
    );
  }
  return (
    <section className="py-16 text-center">
      <h1 className="text-3xl font-bold">{store.name}</h1>
      <p className="mt-2 text-gray-600">صفحة المتجر الرئيسية.</p>
    </section>
  );
}
