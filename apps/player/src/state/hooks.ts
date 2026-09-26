import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { continueWatching, getFavorites, getHistory, subscribeLibrary, toggleFavorite, type FavoriteKind, type HistoryEntry } from "../lib/library";
import { getSettings, subscribeSettings, updateSettings, type Settings } from "../lib/settings";
import { isTvDevice } from "../platform";
import { useActive } from "./session";

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload(): void;
}

/** تحميل غير متزامن مع إعادة المحاولة، ويتجاهل النتائج القديمة إن تغيّرت المدخلات. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean }>({ data: undefined, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let alive = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    loadRef.current().then(
      (data) => alive && setState({ data, error: null, loading: false }),
      (error: unknown) => alive && setState({ data: undefined, error: error instanceof Error ? error : new Error(String(error)), loading: false }),
    );
    return () => {
      alive = false;
    };
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

/** السجل والمفضلة للحساب النشط، ويُعاد الرسم عند أي تغيير. */
export function useLibrary() {
  const { account } = useActive();
  const version = useSyncExternalStore(subscribeLibrary, libraryVersion);
  const history = useMemoByVersion(() => getHistory(account.id), [account.id, version]);
  const favorites = useMemoByVersion(() => getFavorites(account.id), [account.id, version]);
  return {
    history,
    favorites,
    resume: useMemoByVersion(() => continueWatching(history), [history]),
    isFavorite: (kind: FavoriteKind, id: string) => favorites[kind].includes(id),
    toggleFavorite: (kind: FavoriteKind, id: string) => toggleFavorite(account.id, kind, id),
    progress: (key: string): HistoryEntry | undefined => history.find((e) => e.key === key),
  };
}

let libVersion = 0;
subscribeLibrary(() => {
  libVersion++;
});
function libraryVersion() {
  return libVersion;
}

function useMemoByVersion<T>(fn: () => T, deps: unknown[]): T {
  const ref = useRef<{ deps: unknown[]; value: T } | null>(null);
  if (!ref.current || ref.current.deps.length !== deps.length || ref.current.deps.some((d, i) => d !== deps[i])) {
    ref.current = { deps, value: fn() };
  }
  return ref.current.value;
}

let settingsCache = getSettings();
subscribeSettings(() => {
  settingsCache = getSettings();
});

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const s = useSyncExternalStore(subscribeSettings, () => settingsCache);
  return [s, updateSettings];
}

/**
 * tv: جهاز ريموت (أو مفروض من الإعدادات) → قائمة جانبية ومقاسات مكبّرة.
 * wide: شاشة عريضة بلا ريموت (جوال بالعرض، حاسوب) → نفس تخطيط التلفاز بمقاسات عادية.
 */
export function useLayout() {
  const [settings] = useSettings();
  const tv = settings.tvMode === "on" || (settings.tvMode === "auto" && isTvDevice());
  const [width, setWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("tv", tv);
  }, [tv]);
  return { tv, wide: tv || width >= 960 };
}

/** ساعة تتحدث كل دقيقة (للدليل وأشرطة التقدم). */
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}
