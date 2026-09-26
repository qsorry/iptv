import { request } from "../lib/http";
import type { CatalogSource, Category, ContentKind, Episode, LiveChannel, Movie, Series, SeriesInfo } from "./types";

/** قوائم M3U / M3U8 (#EXTM3U). لا EPG فيها حالياً؛ القنوات والأفلام والمسلسلات تُستنتج من الروابط والأسماء. */

export interface M3uEntry {
  name: string;
  url: string;
  attrs: Record<string, string>;
  group?: string;
}

const ATTR = /([a-zA-Z0-9_-]+)="([^"]*)"/g;

export function parseM3u(text: string): M3uEntry[] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/);
  const entries: M3uEntry[] = [];
  let pending: { name: string; attrs: Record<string, string>; group?: string } | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#EXTINF")) {
      const comma = findTitleComma(line);
      const head = comma >= 0 ? line.slice(0, comma) : line;
      const attrs: Record<string, string> = {};
      let m: RegExpExecArray | null;
      ATTR.lastIndex = 0;
      while ((m = ATTR.exec(head))) attrs[m[1].toLowerCase()] = m[2];
      const name = (comma >= 0 ? line.slice(comma + 1) : "").trim() || attrs["tvg-name"] || "";
      pending = { name, attrs, group: attrs["group-title"] || undefined };
    } else if (line.startsWith("#EXTGRP:")) {
      if (pending && !pending.group) pending.group = line.slice(8).trim() || undefined;
    } else if (!line.startsWith("#")) {
      if (/^(https?|rtmp|rtsp):\/\//i.test(line)) {
        entries.push({ name: pending?.name || nameFromUrl(line), url: line, attrs: pending?.attrs ?? {}, group: pending?.group });
      }
      pending = null;
    }
  }
  return entries;
}

/** الفاصلة التي تسبق العنوان هي أول فاصلة خارج علامات التنصيص. */
function findTitleComma(line: string): number {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) return i;
  }
  return -1;
}

function nameFromUrl(url: string): string {
  const last = url.split("?")[0].split("/").pop() ?? url;
  return decodeURIComponent(last.replace(/\.[a-z0-9]+$/i, ""));
}

/** بصمة قصيرة ثابتة للمعرّفات (لا تتغير بتغيّر ترتيب القائمة). */
export function hashId(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

const VIDEO_EXT = /\.(mp4|mkv|avi|mov|m4v|webm|wmv|flv)(\?|$)/i;
const EPISODE = /^(.*?)[\s._\-–|]*S(\d{1,2})\s*[._-]?\s*E(\d{1,3})\b[\s._\-–|:]*(.*)$/i;

export function classify(entry: M3uEntry): ContentKind {
  const path = entry.url.split("?")[0];
  if (/\/series\//i.test(path) || EPISODE.test(entry.name)) return "series";
  if (/\/movie\//i.test(path) || VIDEO_EXT.test(path)) return "movie";
  return "live";
}

export interface M3uCatalog {
  categories: Record<ContentKind, Category[]>;
  live: LiveChannel[];
  movies: Movie[];
  series: Series[];
  episodes: Map<string, Episode[]>;
}

export function buildCatalog(entries: M3uEntry[]): M3uCatalog {
  const cats: Record<ContentKind, Map<string, Category>> = { live: new Map(), movie: new Map(), series: new Map() };
  const catFor = (kind: ContentKind, group?: string) => {
    const name = group?.trim() || "أخرى";
    const id = `${kind}:${hashId(name)}`;
    if (!cats[kind].has(id)) cats[kind].set(id, { id, name, kind });
    return id;
  };

  const live: LiveChannel[] = [];
  const movies: Movie[] = [];
  const seriesById = new Map<string, Series>();
  const episodes = new Map<string, Episode[]>();

  entries.forEach((e) => {
    const kind = classify(e);
    const logo = /^https?:\/\//i.test(e.attrs["tvg-logo"] ?? "") ? e.attrs["tvg-logo"] : undefined;
    if (kind === "live") {
      live.push({ kind: "live", id: hashId(e.url), num: live.length + 1, name: e.name, logo, categoryId: catFor("live", e.group), epgId: e.attrs["tvg-id"] || undefined, url: e.url });
    } else if (kind === "movie") {
      const year = e.name.match(/\((19|20)\d{2}\)/)?.[0].replace(/[()]/g, "");
      movies.push({ kind: "movie", id: hashId(e.url), name: e.name, poster: logo, categoryId: catFor("movie", e.group), year, url: e.url });
    } else {
      const m = e.name.match(EPISODE);
      const seriesName = (m?.[1] || e.group || e.name).trim();
      const seriesId = hashId(`${e.group ?? ""}|${seriesName.toLowerCase()}`);
      if (!seriesById.has(seriesId)) {
        seriesById.set(seriesId, { kind: "series", id: seriesId, name: seriesName, poster: logo, categoryId: catFor("series", e.group) });
      }
      const list = episodes.get(seriesId) ?? [];
      const season = m ? Number(m[2]) : 1;
      const episode = m ? Number(m[3]) : list.length + 1;
      list.push({ id: hashId(e.url), season, episode, title: m?.[4]?.trim() || `الحلقة ${episode}`, image: logo, url: e.url });
      episodes.set(seriesId, list);
    }
  });

  return {
    categories: { live: [...cats.live.values()], movie: [...cats.movie.values()], series: [...cats.series.values()] },
    live,
    movies,
    series: [...seriesById.values()],
    episodes,
  };
}

export class M3uSource implements CatalogSource {
  private loading: Promise<M3uCatalog> | null = null;

  constructor(
    private readonly url: string,
    private readonly fetchText: (url: string) => Promise<string> = async (u) => {
      const res = await request(u, { timeoutMs: 90000 });
      if (res.status >= 400) throw new Error(`تعذّر تحميل القائمة (${res.status})`);
      return res.text;
    },
  ) {}

  load(): Promise<M3uCatalog> {
    if (!this.loading) {
      this.loading = this.fetchText(this.url).then((text) => {
        if (!/#EXTM3U|#EXTINF/i.test(text.slice(0, 2048))) throw new Error("هذا الرابط ليس قائمة M3U صالحة.");
        return buildCatalog(parseM3u(text));
      });
      this.loading.catch(() => (this.loading = null));
    }
    return this.loading;
  }

  async categories(kind: ContentKind) {
    return (await this.load()).categories[kind];
  }

  async liveChannels() {
    return (await this.load()).live;
  }

  async movies() {
    return (await this.load()).movies;
  }

  async series() {
    return (await this.load()).series;
  }

  async seriesInfo(series: Series): Promise<SeriesInfo> {
    const eps = [...((await this.load()).episodes.get(series.id) ?? [])];
    const seasons = new Map<number, Episode[]>();
    for (const e of eps) seasons.set(e.season, [...(seasons.get(e.season) ?? []), e]);
    return {
      series,
      seasons: [...seasons.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([number, list]) => ({ number, name: `الموسم ${number}`, episodes: list.sort((a, b) => a.episode - b.episode) })),
    };
  }

  async movieInfo() {
    return null;
  }

  async shortEpg() {
    return [];
  }

  liveUrl(channel: LiveChannel) {
    return channel.url ?? "";
  }

  movieUrl(movie: Movie) {
    return movie.url ?? "";
  }

  episodeUrl(episode: Episode) {
    return episode.url ?? "";
  }
}
