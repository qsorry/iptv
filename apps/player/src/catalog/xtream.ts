import { HttpError, requestJson, type RequestOptions } from "../lib/http";
import type { AccountStatus, CatalogSource, Category, ContentKind, EpgEntry, Episode, LiveChannel, LiveFormat, Movie, MovieInfo, Season, Series, SeriesInfo } from "./types";

/**
 * عميل Xtream Codes (player_api.php). اللوحات تختلف في الأنواع (أرقام كنصوص، مصفوفات بدل كائنات)،
 * فكل القراءة تمر عبر دوال تطبيع صغيرة ومختبرة.
 */

export interface XtreamCredentials {
  server: string;
  username: string;
  password: string;
}

type Json = Record<string, unknown>;
type FetchJson = <T>(url: string, opts?: RequestOptions) => Promise<T>;

const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() !== "" ? v.trim() : typeof v === "number" ? String(v) : undefined);
const arr = (v: unknown): Json[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === "object") as Json[]) : []);

/** «7.5» أو rating_5based. نعيد تقييماً من 10، أو undefined إن كان صفراً. */
export function rating(item: Json): number | undefined {
  const r = num(item.rating);
  if (r && r > 0) return Math.round(r * 10) / 10;
  const r5 = num(item.rating_5based);
  return r5 && r5 > 0 ? Math.round(r5 * 20) / 10 : undefined;
}

/** السنة من releaseDate أو year أو «(2024)» في الاسم. */
export function yearOf(item: Json): string | undefined {
  const raw = str(item.releaseDate) ?? str(item.releasedate) ?? str(item.release_date) ?? str(item.year);
  const m = (raw ?? "").match(/(19|20)\d{2}/) ?? (str(item.name) ?? "").match(/\((19|20)\d{2}\)/);
  return m ? m[0].replace(/[()]/g, "") : undefined;
}

/** «00:45:12» أو ثوانٍ. */
export function durationSecs(info: Json): number | undefined {
  const s = num(info.duration_secs);
  if (s && s > 0) return s;
  const d = str(info.duration);
  if (!d) return undefined;
  const parts = d.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return undefined;
  return parts.reduce((acc, p) => acc * 60 + p, 0) || undefined;
}

function categoryId(item: Json): string {
  const ids = item.category_ids;
  return str(item.category_id) ?? (Array.isArray(ids) ? str(ids[0]) : undefined) ?? "0";
}

function image(v: unknown): string | undefined {
  const s = str(v);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
}

export function mapCategories(json: unknown, kind: ContentKind): Category[] {
  return arr(json)
    .map((c) => ({ id: str(c.category_id) ?? "", name: str(c.category_name) ?? "بدون اسم", kind }))
    .filter((c) => c.id !== "");
}

export function mapLive(json: unknown): LiveChannel[] {
  return arr(json)
    .map((s, i): LiveChannel => ({
      kind: "live",
      id: str(s.stream_id) ?? "",
      num: num(s.num) ?? i + 1,
      name: str(s.name) ?? "قناة",
      logo: image(s.stream_icon),
      categoryId: categoryId(s),
      epgId: str(s.epg_channel_id),
      added: num(s.added),
    }))
    .filter((c) => c.id !== "");
}

export function mapMovies(json: unknown): Movie[] {
  return arr(json)
    .map((s): Movie => ({
      kind: "movie",
      id: str(s.stream_id) ?? "",
      name: str(s.name) ?? "فيلم",
      poster: image(s.stream_icon) ?? image(s.cover),
      categoryId: categoryId(s),
      rating: rating(s),
      added: num(s.added),
      year: yearOf(s),
      ext: str(s.container_extension),
    }))
    .filter((m) => m.id !== "");
}

export function mapSeries(json: unknown): Series[] {
  return arr(json)
    .map((s): Series => ({
      kind: "series",
      id: str(s.series_id) ?? "",
      name: str(s.name) ?? "مسلسل",
      poster: image(s.cover),
      categoryId: categoryId(s),
      rating: rating(s),
      added: num(s.last_modified) ?? num(s.added),
      year: yearOf(s),
      plot: str(s.plot),
      genre: str(s.genre),
    }))
    .filter((s) => s.id !== "");
}

/** «اسم المسلسل - S01E03 - العنوان» → «العنوان». */
export function cleanEpisodeTitle(title: string, seriesName: string): string {
  let t = title.trim();
  if (seriesName && t.toLowerCase().startsWith(seriesName.toLowerCase())) t = t.slice(seriesName.length);
  t = t.replace(/^[\s\-–:|]*S\d{1,2}\s*E\d{1,3}[\s\-–:|]*/i, "").trim();
  return t;
}

export function mapSeriesInfo(json: unknown, series: Series): SeriesInfo {
  const data = (json && typeof json === "object" ? json : {}) as Json;
  const info = (data.info && typeof data.info === "object" ? data.info : {}) as Json;
  const rawEpisodes = data.episodes;
  // ثلاثة أشكال شائعة: كائن بالمواسم، مصفوفة مصفوفات، أو مصفوفة حلقات مسطّحة.
  const groups: Json[][] = Array.isArray(rawEpisodes)
    ? rawEpisodes.every((g) => Array.isArray(g))
      ? rawEpisodes.map((g) => arr(g))
      : [arr(rawEpisodes)]
    : rawEpisodes && typeof rawEpisodes === "object"
      ? Object.values(rawEpisodes as Json).map((g) => arr(g))
      : [];

  const bySeason = new Map<number, Episode[]>();
  for (const group of groups) {
    for (const e of group) {
      const epInfo = (e.info && typeof e.info === "object" ? e.info : {}) as Json;
      const season = num(e.season) ?? 1;
      const episode = num(e.episode_num) ?? (bySeason.get(season)?.length ?? 0) + 1;
      const id = str(e.id);
      if (!id) continue;
      const title = cleanEpisodeTitle(str(e.title) ?? "", series.name);
      const list = bySeason.get(season) ?? [];
      list.push({
        id,
        season,
        episode,
        title: title || `الحلقة ${episode}`,
        duration: durationSecs(epInfo),
        plot: str(epInfo.plot),
        image: image(epInfo.movie_image) ?? image(epInfo.cover_big),
        ext: str(e.container_extension),
      });
      bySeason.set(season, list);
    }
  }

  // أسماء المواسم من المزوّد غالباً «Season 1» بالإنجليزية؛ نعرضها بالعربية من رقمها.
  const seasons: Season[] = [...bySeason.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([number, episodes]) => ({
      number,
      name: `الموسم ${number}`,
      episodes: episodes.sort((a, b) => a.episode - b.episode),
    }));

  const backdrop = Array.isArray(info.backdrop_path) ? image(info.backdrop_path[0]) : image(info.backdrop_path);
  return {
    series: { ...series, poster: series.poster ?? image(info.cover), plot: series.plot ?? str(info.plot), genre: series.genre ?? str(info.genre), rating: series.rating ?? rating(info) },
    plot: str(info.plot) ?? series.plot,
    genre: str(info.genre) ?? series.genre,
    cast: str(info.cast),
    backdrop,
    seasons,
  };
}

export function mapMovieInfo(json: unknown): MovieInfo | null {
  const data = (json && typeof json === "object" ? json : {}) as Json;
  const info = (data.info && typeof data.info === "object" ? data.info : null) as Json | null;
  if (!info) return null;
  const backdrop = Array.isArray(info.backdrop_path) ? image(info.backdrop_path[0]) : image(info.backdrop_path);
  return {
    plot: str(info.plot) ?? str(info.description),
    genre: str(info.genre),
    cast: str(info.cast) ?? str(info.actors),
    director: str(info.director),
    duration: durationSecs(info),
    rating: rating(info),
    year: yearOf(info),
    backdrop,
  };
}

/** عناوين EPG في Xtream مرمّزة base64 (UTF-8). */
export function decodeBase64Utf8(s: string): string {
  try {
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return s;
  }
}

export function mapShortEpg(json: unknown): EpgEntry[] {
  const data = (json && typeof json === "object" ? json : {}) as Json;
  return arr(data.epg_listings)
    .map((e) => {
      const start = num(e.start_timestamp);
      const end = num(e.stop_timestamp) ?? num(e.end_timestamp);
      return {
        title: decodeBase64Utf8(str(e.title) ?? "").trim(),
        description: e.description ? decodeBase64Utf8(String(e.description)).trim() || undefined : undefined,
        start: (start ?? 0) * 1000,
        end: (end ?? 0) * 1000,
      };
    })
    .filter((e) => e.title && e.start > 0 && e.end > e.start)
    .sort((a, b) => a.start - b.start);
}

export function mapAccountStatus(json: unknown): AccountStatus {
  const data = (json && typeof json === "object" ? json : {}) as Json;
  const user = (data.user_info && typeof data.user_info === "object" ? data.user_info : null) as Json | null;
  if (!user || num(user.auth) !== 1) throw new HttpError("اسم المستخدم أو كلمة المرور غير صحيحة.", "status", 401);
  const status = str(user.status) ?? "Active";
  const exp = num(user.exp_date);
  const formats = Array.isArray(user.allowed_output_formats) ? user.allowed_output_formats.map(String) : [];
  return {
    status,
    expiresAt: exp && exp > 0 ? exp * 1000 : null,
    maxConnections: num(user.max_connections),
    activeConnections: num(user.active_cons),
    isTrial: str(user.is_trial) === "1",
    formats,
  };
}

/** رسالة عربية لحالات الاشتراك غير الفعّالة، أو null إن كان فعّالاً. */
export function statusProblem(s: AccountStatus, now = Date.now()): string | null {
  const st = s.status.toLowerCase();
  if (st === "expired" || (s.expiresAt !== null && s.expiresAt <= now)) return "انتهى اشتراكك. جدّده من مزوّدك ثم حاول مرة أخرى.";
  if (st === "banned" || st === "disabled") return "هذا الحساب موقوف لدى المزوّد.";
  if (st !== "active") return `حالة الاشتراك لدى المزوّد: ${s.status}`;
  return null;
}

function apiUrl(c: XtreamCredentials, params: Record<string, string>) {
  const q = new URLSearchParams({ username: c.username, password: c.password, ...params });
  return `${c.server}/player_api.php?${q.toString()}`;
}

/** يتحقق من الحساب ويعيد حالته، أو يرمي برسالة عربية مفهومة. */
export async function xtreamLogin(c: XtreamCredentials, fetchJson: FetchJson = requestJson): Promise<AccountStatus> {
  let json: unknown;
  try {
    json = await fetchJson(apiUrl(c, {}), { timeoutMs: 20000 });
  } catch (e) {
    if (e instanceof HttpError && (e.status === 401 || e.status === 403)) throw new HttpError("اسم المستخدم أو كلمة المرور غير صحيحة.", "status", e.status);
    if (e instanceof HttpError && e.kind === "parse") throw new HttpError("هذا الرابط ليس خادم Xtream صالحاً.", "parse");
    throw e;
  }
  const status = mapAccountStatus(json);
  const problem = statusProblem(status);
  if (problem) throw new HttpError(problem, "status", 403);
  return status;
}

const pathPart = (s: string) => encodeURIComponent(s);

export class XtreamSource implements CatalogSource {
  private cache = new Map<string, { at: number; value: Promise<unknown> }>();

  constructor(
    private readonly creds: XtreamCredentials,
    private readonly fetchJson: FetchJson = requestJson,
  ) {}

  /** يعيد نفس الوعد للطلبات المتكررة؛ يُنسى عند الفشل أو بعد ttl. */
  private cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
    const value = load();
    this.cache.set(key, { at: Date.now(), value });
    value.catch(() => this.cache.delete(key));
    return value;
  }

  private get<T>(params: Record<string, string>, timeoutMs = 60000) {
    return this.fetchJson<T>(apiUrl(this.creds, params), { timeoutMs });
  }

  categories(kind: ContentKind) {
    const action = kind === "live" ? "get_live_categories" : kind === "movie" ? "get_vod_categories" : "get_series_categories";
    return this.cached(action, 30 * 60_000, async () => mapCategories(await this.get({ action }), kind));
  }

  liveChannels() {
    return this.cached("live", 30 * 60_000, async () => mapLive(await this.get({ action: "get_live_streams" })));
  }

  movies() {
    return this.cached("movies", 30 * 60_000, async () => mapMovies(await this.get({ action: "get_vod_streams" })));
  }

  series() {
    return this.cached("series", 30 * 60_000, async () => mapSeries(await this.get({ action: "get_series" })));
  }

  seriesInfo(series: Series) {
    return this.cached(`series:${series.id}`, 30 * 60_000, async () => mapSeriesInfo(await this.get({ action: "get_series_info", series_id: series.id }, 30000), series));
  }

  movieInfo(movie: Movie) {
    return this.cached(`movie:${movie.id}`, 30 * 60_000, async () => mapMovieInfo(await this.get({ action: "get_vod_info", vod_id: movie.id }, 30000)));
  }

  shortEpg(channel: LiveChannel, limit: number) {
    return this.cached(`epg:${channel.id}:${limit}`, 5 * 60_000, async () =>
      mapShortEpg(await this.get({ action: "get_short_epg", stream_id: channel.id, limit: String(limit) }, 15000)),
    );
  }

  liveUrl(channel: LiveChannel, format: LiveFormat) {
    const { server, username, password } = this.creds;
    return `${server}/live/${pathPart(username)}/${pathPart(password)}/${channel.id}.${format}`;
  }

  movieUrl(movie: Movie) {
    const { server, username, password } = this.creds;
    return `${server}/movie/${pathPart(username)}/${pathPart(password)}/${movie.id}.${movie.ext || "mp4"}`;
  }

  episodeUrl(episode: Episode) {
    const { server, username, password } = this.creds;
    return `${server}/series/${pathPart(username)}/${pathPart(password)}/${episode.id}.${episode.ext || "mp4"}`;
  }
}
