import { useEffect, useMemo, useState } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary } from "../state/hooks";
import { href } from "../nav/router";
import { isFinished, type HistoryEntry } from "../lib/library";
import { count, EPISODES, remaining, SEASONS, shortDuration } from "../lib/format";
import type { Episode, SeriesInfo } from "../catalog/types";
import { Icon } from "../components/Icon";
import { ErrorState, Loading, Media, Progress } from "../components/ui";
import { DetailHero, categoryName } from "./MovieDetails";

export function episodeHref(seriesId: string, ep: Episode, t = 0) {
  return href(`/play/episode/${encodeURIComponent(seriesId)}/${encodeURIComponent(ep.id)}${t > 0 ? `?t=${Math.floor(t)}` : ""}`);
}

/** آخر حلقة شوهدت من هذا المسلسل، والحلقة التي يُكمل منها (التالية إن انتهت). */
export function resumePoint(info: SeriesInfo, history: HistoryEntry[]): { episode: Episode; position: number } | null {
  const last = history.find((e) => e.kind === "episode" && e.seriesId === info.series.id);
  if (!last) return null;
  const all = info.seasons.flatMap((s) => s.episodes);
  const idx = all.findIndex((e) => e.id === last.itemId);
  if (idx < 0) return null;
  if (!isFinished(last)) return { episode: all[idx], position: last.position };
  return idx + 1 < all.length ? { episode: all[idx + 1], position: 0 } : null;
}

function epLabel(ep: Episode) {
  return ep.season > 1 ? `م${ep.season} ح${ep.episode}` : `ح${ep.episode}`;
}

export function SeriesDetails({ id, wide, season }: { id: string; wide: boolean; season: string | null }) {
  const { source } = useActive();
  const { history, isFavorite, toggleFavorite, progress } = useLibrary();
  const data = useAsync(async () => {
    const [list, categories] = await Promise.all([source.series(), source.categories("series")]);
    const series = list.find((s) => s.id === id);
    if (!series) throw new Error("هذا المسلسل غير متوفر لدى مزوّدك الآن.");
    return { info: await source.seriesInfo(series), categories };
  }, [source, id]);

  const info = data.data?.info;
  const resume = useMemo(() => (info ? resumePoint(info, history) : null), [info, history]);
  const [seasonNo, setSeasonNo] = useState<number | null>(season ? Number(season) : null);
  useEffect(() => {
    if (info && seasonNo === null) setSeasonNo(resume?.episode.season ?? info.seasons[0]?.number ?? 1);
  }, [info, resume, seasonNo]);

  if (data.loading && !data.data) return <div className="screen"><Loading /></div>;
  if (data.error) return <div className="screen"><ErrorState error={data.error} onRetry={data.reload} /></div>;
  const { categories } = data.data!;
  const s = info!.series;
  const current = info!.seasons.find((x) => x.number === seasonNo) ?? info!.seasons[0];
  const first = info!.seasons[0]?.episodes[0];
  const fav = isFavorite("series", s.id);
  const genre = info!.genre?.split(/[,،/]/)[0]?.trim() ?? categoryName(categories, s.categoryId);
  const meta = [s.year, genre, info!.seasons.length ? count(info!.seasons.length, SEASONS) : undefined, s.rating ? `★ ${s.rating}` : undefined].filter(Boolean).join(" · ");

  return (
    <div className={`detail${wide ? " detail-wide" : ""}`}>
      <DetailHero
        id={s.id}
        title={s.name}
        poster={s.poster}
        backdrop={info!.backdrop}
        wide={wide}
        chips={[categoryName(categories, s.categoryId)].filter((x): x is string => !!x)}
        meta={meta}
        plot={info!.plot}
        actions={
          <>
            {resume ? (
              <a className="btn btn-primary btn-lg" href={episodeHref(s.id, resume.episode, resume.position)} data-autofocus>
                <Icon name="play" size={18} />
                <span>متابعة · {epLabel(resume.episode)}</span>
              </a>
            ) : (
              first && (
                <a className="btn btn-primary btn-lg" href={episodeHref(s.id, first)} data-autofocus>
                  <Icon name="play" size={18} />
                  <span>تشغيل</span>
                </a>
              )
            )}
            {resume && first && (
              <a className="btn btn-secondary btn-lg" href={episodeHref(s.id, first)}>
                من البداية
              </a>
            )}
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => toggleFavorite("series", s.id)} aria-pressed={fav}>
              <Icon name={fav ? "check" : "plus"} size={18} />
              <span>قائمتي</span>
            </button>
          </>
        }
      />

      <div className="detail-body stack-5">
        {info!.seasons.length === 0 ? (
          <p className="muted">لا توجد حلقات متاحة لهذا المسلسل حالياً.</p>
        ) : (
          <>
            <div className="row row-wrap season-bar">
              <div className="rail grow" data-nav-region="seasons">
                {info!.seasons.map((x) => (
                  <button key={x.number} type="button" className={`chip${x.number === current.number ? " is-on" : ""}`} onClick={() => setSeasonNo(x.number)} aria-pressed={x.number === current.number}>
                    {x.name}
                  </button>
                ))}
              </div>
              <div className="muted small">{count(current.episodes.length, EPISODES)}</div>
            </div>
            <div className={wide ? "rail" : "stack-3"} data-nav-region="episodes">
              {current.episodes.map((ep) => {
                const p = progress(`episode:${ep.id}`);
                const done = p ? isFinished(p) : false;
                const state = done ? "شوهدت" : p && p.position > 30 ? remaining(p.position, p.duration) : "لم تُشاهد";
                const value = done ? 1 : p ? p.position / p.duration : 0;
                return wide ? (
                  <a key={ep.id} className="tile episode-card" href={episodeHref(s.id, ep, done ? 0 : (p?.position ?? 0))}>
                    <div className="thumb">
                      <Media src={ep.image} seed={ep.id} name={ep.title} showInitial={false} />
                      <span className="badge corner-tr">ح {ep.episode}</span>
                      <span className="play-circle play-circle-sm episode-play">
                        <Icon name="play" size={22} />
                      </span>
                      <Progress value={value} className="progress-bottom" />
                    </div>
                    <div className="row row-2 row-baseline episode-line">
                      <div className="grow truncate episode-title">{ep.title}</div>
                      {ep.duration && <div className="tile-meta">{shortDuration(ep.duration)}</div>}
                    </div>
                    <div className="tile-meta">{state}</div>
                  </a>
                ) : (
                  <a key={ep.id} className="episode-row" href={episodeHref(s.id, ep, done ? 0 : (p?.position ?? 0))}>
                    <div className="episode-row-thumb">
                      <div className="thumb">
                        <Media src={ep.image} seed={ep.id} name={ep.title} showInitial={false} />
                        <span className="media-play">
                          <Icon name="play" size={20} />
                        </span>
                        <Progress value={value} className="progress-bottom" />
                      </div>
                    </div>
                    <div className="grow stack-1">
                      <div className="episode-title truncate">
                        {ep.episode}. {ep.title}
                      </div>
                      <div className="tile-meta">
                        {[ep.duration ? shortDuration(ep.duration) : undefined, state].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
