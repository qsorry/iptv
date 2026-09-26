/** نموذج موحّد للمحتوى أياً كان مصدره (Xtream Codes أو قائمة M3U). */

export type ContentKind = "live" | "movie" | "series";

export interface Category {
  id: string;
  name: string;
  kind: ContentKind;
}

export interface LiveChannel {
  kind: "live";
  id: string;
  num: number;
  name: string;
  logo?: string;
  categoryId: string;
  epgId?: string;
  /** للقوائم M3U: الرابط كما هو. في Xtream يُبنى من الحساب. */
  url?: string;
  added?: number;
}

export interface Movie {
  kind: "movie";
  id: string;
  name: string;
  poster?: string;
  categoryId: string;
  rating?: number;
  /** بالثواني (unix). */
  added?: number;
  year?: string;
  ext?: string;
  url?: string;
}

export interface Series {
  kind: "series";
  id: string;
  name: string;
  poster?: string;
  categoryId: string;
  rating?: number;
  added?: number;
  year?: string;
  plot?: string;
  genre?: string;
}

export type CatalogItem = LiveChannel | Movie | Series;

export interface Episode {
  id: string;
  season: number;
  episode: number;
  title: string;
  /** بالثواني. */
  duration?: number;
  plot?: string;
  image?: string;
  ext?: string;
  url?: string;
}

export interface Season {
  number: number;
  name: string;
  episodes: Episode[];
}

export interface SeriesInfo {
  series: Series;
  plot?: string;
  genre?: string;
  cast?: string;
  backdrop?: string;
  seasons: Season[];
}

export interface MovieInfo {
  plot?: string;
  genre?: string;
  cast?: string;
  director?: string;
  /** بالثواني. */
  duration?: number;
  rating?: number;
  year?: string;
  backdrop?: string;
}

/** برنامج في دليل البرامج. الأوقات بالمللي ثانية. */
export interface EpgEntry {
  title: string;
  description?: string;
  start: number;
  end: number;
}

/** معلومات الاشتراك من المزوّد (Xtream فقط). */
export interface AccountStatus {
  status: string;
  /** بالمللي ثانية، أو null لاشتراك بلا انتهاء. */
  expiresAt: number | null;
  maxConnections?: number;
  activeConnections?: number;
  isTrial?: boolean;
  formats: string[];
}

/** مصدر محتوى: كل الشاشات تتعامل مع هذه الواجهة فقط. */
export interface CatalogSource {
  categories(kind: ContentKind): Promise<Category[]>;
  liveChannels(): Promise<LiveChannel[]>;
  movies(): Promise<Movie[]>;
  series(): Promise<Series[]>;
  seriesInfo(series: Series): Promise<SeriesInfo>;
  movieInfo(movie: Movie): Promise<MovieInfo | null>;
  /** البرنامج الحالي والتالي (وما بعدهما حتى limit). */
  shortEpg(channel: LiveChannel, limit: number): Promise<EpgEntry[]>;
  liveUrl(channel: LiveChannel, format: LiveFormat): string;
  movieUrl(movie: Movie): string;
  episodeUrl(episode: Episode): string;
}

export type LiveFormat = "m3u8" | "ts";
