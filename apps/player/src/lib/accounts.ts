import { readJson, writeJson } from "./storage";

/** حساب محفوظ على الجهاز. كلمات المرور تبقى محلياً ولا تُرسل إلا لخادم المزوّد. */
export type Account =
  | {
      id: string;
      type: "xtream";
      /** الاسم الظاهر: اسم المزوّد أو ما كتبه المستخدم. */
      name: string;
      server: string;
      username: string;
      password: string;
      providerName?: string;
      serverLabel?: string;
      createdAt: number;
    }
  | {
      id: string;
      type: "m3u";
      name: string;
      url: string;
      createdAt: number;
    };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type NewAccount = DistributiveOmit<Account, "id" | "createdAt">;

const ACCOUNTS_KEY = "accounts";
const ACTIVE_KEY = "active-account";

export function loadAccounts(): Account[] {
  const list = readJson<Account[]>(ACCOUNTS_KEY, []);
  return Array.isArray(list) ? list : [];
}

export function saveAccounts(list: Account[]) {
  writeJson(ACCOUNTS_KEY, list);
}

export function loadActiveId(): string | null {
  return readJson<string | null>(ACTIVE_KEY, null);
}

export function saveActiveId(id: string | null) {
  writeJson(ACTIVE_KEY, id);
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** نفس الحساب إن تطابق الخادم واسم المستخدم (أو رابط القائمة): نحدّثه بدل تكراره. */
export function sameAccount(a: Account, b: NewAccount): boolean {
  if (a.type === "xtream" && b.type === "xtream") return a.server === b.server && a.username === b.username;
  if (a.type === "m3u" && b.type === "m3u") return a.url === b.url;
  return false;
}

/** «http://host:8080/get.php?username=u&password=p&type=m3u_plus» حساب Xtream متنكّر: نستخدم الـ API الأفضل. */
export function xtreamFromUrl(input: string): { server: string; username: string; password: string } | null {
  try {
    const url = new URL(input.trim());
    const username = url.searchParams.get("username");
    const password = url.searchParams.get("password");
    if (!username || !password || !/\/(get|player_api)\.php$/i.test(url.pathname)) return null;
    return { server: url.origin, username, password };
  } catch {
    return null;
  }
}

/** يقبل «host:8080» أو رابطاً كاملاً ويعيد الأصل فقط. */
export function normalizeServer(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}
