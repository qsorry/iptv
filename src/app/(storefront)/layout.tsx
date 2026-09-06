import Link from "next/link";
import { Container } from "@/components/ui/container";
import { getStorefrontStore } from "@/core/tenancy/server";
import { readCartId } from "@/core/tenancy/cart-cookie";
import { getCartView } from "@/modules/carts";

/** Layout واجهة المتجر. يُحدَّد المتجر من الدومين عبر middleware (core/tenancy). */
export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const store = await getStorefrontStore();
  const cartId = store ? await readCartId(store.id) : undefined;
  const cart = store && cartId ? await getCartView(store.id, cartId) : null;
  const count = cart?.count ?? 0;
  return (
    <>
      <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)] pt-[var(--safe-top)]">
        <Container className="flex items-center justify-between py-3 sm:py-4">
          <Link href="/" className="text-lg font-bold sm:text-xl">{store?.name ?? "المتجر"}</Link>
          <nav className="flex items-center gap-1 text-sm sm:gap-3">
            <Link href="/cart" className="touch-target rounded-[var(--radius)] px-3 py-2 hover:bg-black/5">السلة{count > 0 && <span className="ms-1 rounded-full bg-[var(--brand)] px-1.5 text-xs text-white" dir="ltr">{count}</span>}</Link>
            <Link href="/account" className="touch-target rounded-[var(--radius)] px-3 py-2 hover:bg-black/5">حسابي</Link>
          </nav>
        </Container>
      </header>
      <main className="pb-[calc(1.5rem+var(--safe-bottom))]">
        <Container className="py-4 sm:py-6">{children}</Container>
      </main>
    </>
  );
}
