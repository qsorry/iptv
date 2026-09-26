import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { loadAccounts, loadActiveId, newId, saveAccounts, saveActiveId, sameAccount, type Account, type NewAccount } from "../lib/accounts";
import { XtreamSource } from "../catalog/xtream";
import { M3uSource } from "../catalog/m3u";
import type { CatalogSource } from "../catalog/types";

/** الحسابات المحفوظة والحساب النشط ومصدر محتواه. */
interface SessionValue {
  accounts: Account[];
  account: Account | null;
  source: CatalogSource | null;
  addAccount(input: NewAccount): Account;
  switchAccount(id: string): void;
  removeAccount(id: string): void;
}

const SessionContext = createContext<SessionValue | null>(null);

export function sourceFor(account: Account): CatalogSource {
  return account.type === "xtream"
    ? new XtreamSource({ server: account.server, username: account.username, password: account.password })
    : new M3uSource(account.url);
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>(loadAccounts);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const id = loadActiveId();
    const list = loadAccounts();
    return list.some((a) => a.id === id) ? id : (list[0]?.id ?? null);
  });

  const account = accounts.find((a) => a.id === activeId) ?? null;
  // مصدر واحد لكل حساب طوال الجلسة حتى تبقى القوائم المحمّلة في الذاكرة.
  const source = useMemo(() => (account ? sourceFor(account) : null), [account]);

  const persist = useCallback((list: Account[], active: string | null) => {
    saveAccounts(list);
    saveActiveId(active);
    setAccounts(list);
    setActiveId(active);
  }, []);

  const addAccount = useCallback(
    (input: NewAccount) => {
      const existing = accounts.find((a) => sameAccount(a, input));
      const saved = { ...(existing ?? { id: newId(), createdAt: Date.now() }), ...input } as Account;
      const list = existing ? accounts.map((a) => (a.id === existing.id ? saved : a)) : [...accounts, saved];
      persist(list, saved.id);
      return saved;
    },
    [accounts, persist],
  );

  const switchAccount = useCallback((id: string) => persist(accounts, id), [accounts, persist]);

  const removeAccount = useCallback(
    (id: string) => {
      const list = accounts.filter((a) => a.id !== id);
      persist(list, activeId === id ? (list[0]?.id ?? null) : activeId);
    },
    [accounts, activeId, persist],
  );

  const value = useMemo(() => ({ accounts, account, source, addAccount, switchAccount, removeAccount }), [accounts, account, source, addAccount, switchAccount, removeAccount]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("SessionProvider مفقود");
  return ctx;
}

/** للشاشات التي لا تُفتح إلا بحساب نشط. */
export function useActive(): { account: Account; source: CatalogSource } {
  const { account, source } = useSession();
  if (!account || !source) throw new Error("لا حساب نشط");
  return { account, source };
}
