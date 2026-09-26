import { useMemo } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary } from "../state/hooks";
import { href, goBack } from "../nav/router";
import { isFinished } from "../lib/library";
import { shortDuration, timecode } from "../lib/format";
import { Icon } from "../components/Icon";
import { ErrorState, Loading, Media } from "../components/ui";
import type { Category } from "../catalog/types";

/** رأس صفحة التفاصيل (فيلم أو مسلسل): الشارات، العنوان، سطر المعلومات، الوصف، الأزرار، والملصق. */
export function DetailHero({ id, title, poster, backdrop, chips, meta, plot, actions, wide }: { id: string; title: string; poster?: string; backdrop?: string; chips: string[]; meta: string; plot?: string; actions: React.ReactNode; wide: boolean }) {
  return (
    <section className={`detail-hero${wide ? " detail-hero-wide" : ""}`}>
      {backdrop && (
        <div className="detail-backdrop" aria-hidden="true">
          <Media src={backdrop} seed={id} name={title} showInitial={false} />
          <span className="detail-backdrop-scrim" />
        </div>
      )}
      {!wide && (
        <button type="button" className="icon-btn icon-btn-bare detail-back" aria-label="رجوع" onClick={() => goBack()}>
          <Icon name="back" size={24} />
        </button>
      )}
      <div className="detail-info stack-3">
        {chips.length > 0 && (
          <div className="row row-2 row-wrap">
            {chips.map((c) => (
              <span key={c} className="badge badge-soft">{c}</span>
            ))}
          </div>
        )}
        <h1 className="detail-title">{title}</h1>
        {meta && <div className="detail-meta">{meta}</div>}
        {plot && <p className="detail-plot">{plot}</p>}
        <div className="row row-2 row-wrap detail-actions">{actions}</div>
      </div>
      <div className="detail-poster">
        <div className="poster">
          <Media src={poster} seed={id} name={title} />
        </div>
      </div>
    </section>
  );
}

export function categoryName(categories: Category[] | undefined, id: string) {
  return categories?.find((c) => c.id === id)?.name;
}

export function MovieDetails({ id, wide }: { id: string; wide: boolean }) {
  const { source } = useActive();
  const { progress, isFavorite, toggleFavorite } = useLibrary();
  const data = useAsync(async () => {
    const [movies, categories] = await Promise.all([source.movies(), source.categories("movie")]);
    const movie = movies.find((m) => m.id === id);
    if (!movie) throw new Error("هذا الفيلم غير متوفر لدى مزوّدك الآن.");
    const info = await source.movieInfo(movie).catch(() => null);
    return { movie, info, categories };
  }, [source, id]);

  const entry = progress(`movie:${id}`);
  const resumable = entry && entry.position > 30 && !isFinished(entry);
  const playHref = (t: number) => href(`/play/movie/${encodeURIComponent(id)}?t=${Math.floor(t)}`);
  const cat = useMemo(() => categoryName(data.data?.categories, data.data?.movie.categoryId ?? ""), [data.data]);

  if (data.loading && !data.data) return <div className="screen"><Loading /></div>;
  if (data.error) return <div className="screen"><ErrorState error={data.error} onRetry={data.reload} /></div>;
  const { movie, info } = data.data!;
  const fav = isFavorite("movie", movie.id);
  const meta = [info?.year ?? movie.year, info?.genre ?? cat, info?.duration ? shortDuration(info.duration) : undefined, (info?.rating ?? movie.rating) ? `★ ${info?.rating ?? movie.rating}` : undefined].filter(Boolean).join(" · ");

  return (
    <div className={`detail${wide ? " detail-wide" : ""}`}>
      <DetailHero
        id={movie.id}
        title={movie.name}
        poster={movie.poster}
        backdrop={info?.backdrop}
        wide={wide}
        chips={[cat, movie.ext ? movie.ext.toUpperCase() : undefined].filter((x): x is string => !!x)}
        meta={meta}
        plot={info?.plot}
        actions={
          <>
            <a className="btn btn-primary btn-lg" href={playHref(resumable ? entry.position : 0)} data-autofocus>
              <Icon name="play" size={18} />
              <span>{resumable ? `متابعة · ${timecode(entry.position)}` : "تشغيل"}</span>
            </a>
            {resumable && (
              <a className="btn btn-secondary btn-lg" href={playHref(0)}>
                من البداية
              </a>
            )}
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => toggleFavorite("movie", movie.id)} aria-pressed={fav}>
              <Icon name={fav ? "check" : "plus"} size={18} />
              <span>قائمتي</span>
            </button>
          </>
        }
      />
      {(info?.cast || info?.director) && (
        <div className="detail-body stack-2">
          {info.director && (
            <p>
              <span className="muted">إخراج: </span>
              {info.director}
            </p>
          )}
          {info.cast && (
            <p>
              <span className="muted">بطولة: </span>
              {info.cast}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
