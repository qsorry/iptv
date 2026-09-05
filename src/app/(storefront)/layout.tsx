import Link from "next/link";

/** Layout واجهة المتجر. يُحدَّد المتجر لاحقاً من الدومين عبر middleware (core/tenancy). */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <Link href="/" className="text-xl font-bold">المتجر</Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/cart">السلة</Link>
            <Link href="/account">حسابي</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </>
  );
}
