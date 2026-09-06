import "server-only";
import { cookies } from "next/headers";

const PREFIX = "cart_";

/** اسم كوكي السلة خاص بكل متجر. */
const cookieName = (storeId: string) => `${PREFIX}${storeId.slice(0, 8)}`;

export async function readCartId(storeId: string): Promise<string | undefined> {
  return (await cookies()).get(cookieName(storeId))?.value;
}

export async function writeCartId(storeId: string, cartId: string) {
  (await cookies()).set(cookieName(storeId), cartId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearCartId(storeId: string) {
  (await cookies()).delete(cookieName(storeId));
}
