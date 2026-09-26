import { readJson, writeJson } from "./storage";

/**
 * سجل المشاهدة والمفضلة لكل حساب على الجهاز. التغييرات تُبث للمشتركين حتى تتحدث الشاشات فوراً.
 */

export interface HistoryEntry {
  /** «movie:12» أو «episode:34» أو «live:56». */
  key: string;
  kind: "live" | "movie" | "episode";
  itemId: string;
  title: string;
  subtitle?: string;
  image?: string;
  seriesId?: string;
  season?: number;
  episode?: number;
  /** بالثواني. */
  position: number;
  duration: number;
  updatedAt: number;
}

export type FavoriteKind = "live" | "movie" | "series";
export type Favorites = Record<FavoriteKind, string[]>;

const MAX_HISTORY = 200;
const listeners = new Set<() => void>();

export function subscribeLibrary(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function emit() {
  listeners.forEach((fn) => fn());
}

const historyKey = (accountId: string) => `history:${accountId}`;
const favoritesKey = (accountId: string) => `favorites:${accountId}`;

export function getHistory(accountId: string): HistoryEntry[] {
  return readJson<HistoryEntry[]>(historyKey(accountId), []);
}

export function recordHistory(accountId: string, entry: Omit<HistoryEntry, "updatedAt">, now = Date.now()) {
  const list = getHistory(accountId).filter((e) => e.key !== entry.key);
  list.unshift({ ...entry, updatedAt: now });
  writeJson(historyKey(accountId), list.slice(0, MAX_HISTORY));
  emit();
}

export function clearHistory(accountId: string) {
  writeJson(historyKey(accountId), []);
  emit();
}

/** شوهد بما يكفي ليُعدّ منتهياً: آخر 5%، أو آخر دقيقتين (شارة النهاية) في ما يزيد عن 20 دقيقة. */
export function isFinished(e: Pick<HistoryEntry, "position" | "duration">): boolean {
  if (!(e.duration > 0)) return false;
  return e.position >= e.duration * 0.95 || (e.duration >= 20 * 60 && e.duration - e.position < 120);
}

/**
 * «تابع المشاهدة»: أفلام وحلقات بدأت ولم تنتهِ، أحدثها أولاً، وحلقة واحدة لكل مسلسل.
 */
export function continueWatching(history: HistoryEntry[]): HistoryEntry[] {
  const seenSeries = new Set<string>();
  const out: HistoryEntry[] = [];
  for (const e of history) {
    if (e.kind === "live" || e.position < 30 || isFinished(e)) continue;
    if (e.seriesId) {
      if (seenSeries.has(e.seriesId)) continue;
      seenSeries.add(e.seriesId);
    }
    out.push(e);
  }
  return out;
}

export function progressOf(history: HistoryEntry[], key: string): HistoryEntry | undefined {
  return history.find((e) => e.key === key);
}

export function getFavorites(accountId: string): Favorites {
  const f = readJson<Partial<Favorites>>(favoritesKey(accountId), {});
  return { live: f.live ?? [], movie: f.movie ?? [], series: f.series ?? [] };
}

export function toggleFavorite(accountId: string, kind: FavoriteKind, id: string): boolean {
  const favs = getFavorites(accountId);
  const has = favs[kind].includes(id);
  favs[kind] = has ? favs[kind].filter((x) => x !== id) : [id, ...favs[kind]];
  writeJson(favoritesKey(accountId), favs);
  emit();
  return !has;
}
