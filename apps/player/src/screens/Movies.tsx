import { useMemo } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary } from "../state/hooks";
import { href } from "../nav/router";
import type { Category, Movie, Series } from "../catalog/types";
import { Icon } from "../components/Icon";
import { ErrorState, Loading, Media, Poster, SectionHead, toneFor } from "../components/ui";
import { newest } from "./Home";

type Item = Movie | Series;

export function detailHref(item: Item) {
  return href(`/${item.kind === "movie" ? "movies" : "series"}/${encodeURIComponent(item.id)}`);
}

/** «2025 · دراما» تحت الملصق (التقييم في شارة الملصق). */
export function metaLine(item: Item, categories: Category[]): string {
  const genre = (item.kind === "series" ? item.genre?.split(/[,،/]/)[0]?.trim() : undefined) ?? categories.find((c) => c.id === item.categoryId)?.name;
  return [item.year, genre].filter(Boolean).join(" · ");
}

/** واجهة الجوال للأفلام (والمسلسلات بنفس البنية): تصنيفات، مميّز، أُضيف حديثاً، الأعلى تقييماً. */
export function CatalogLanding({ kind }: { kind: "movie" | "series" }) {
  const { source } = useActive();
  const { isFavorite, toggleFavorite } = useLibrary();
  const data = useAsync(async () => {
    const [categories, items] = await Promise.all([source.categories(kind), kind === "movie" ? source.movies() : source.series()]);
    return { categories, items: items as Item[] };
  }, [source, kind]);

  const fresh = useMemo(() => newest(data.data?.items ?? []), [data.data]);
  const top = useMemo(() => (data.data?.items ?? []).filter((i) => i.rating).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 10), [data.data]);
  const title = kind === "movie" ? "أفلام" : "مسلسلات";
  const base = kind === "movie" ? "movie" : "series";

  if (data.loading && !data.data) return <div className="screen"><Loading /></div>;
  if (data.error) return <div className="screen"><ErrorState error={data.error} onRetry={data.reload} /></div>;
  const { categories, items } = data.data!;
  const featured = fresh[0];

  return (
    <div className="screen stack-5">
      <header className="row">
        <h1 className="page-title grow">{title}</h1>
        <a className="icon-btn" href={href(`/search`)} aria-label="بحث">
          <Icon name="search" size={20} />
        </a>
        <a className="icon-btn" href={href(`/browse/${base}?cat=all`)} aria-label="كل التصنيفات">
          <Icon name="filter" size={20} />
        </a>
      </header>

      <nav className="rail" aria-label="التصنيفات">
        <a className="chip is-on" href={href(`/browse/${base}?cat=all`)}>الكل</a>
        {categories.map((c) => (
          <a key={c.id} className="chip" href={href(`/browse/${base}?cat=${encodeURIComponent(c.id)}`)}>
            {c.name}
          </a>
        ))}
      </nav>

      {items.length === 0 ? (
        <p className="muted">لا يوجد محتوى في هذا القسم لدى مزوّدك.</p>
      ) : (
        <>
          {featured && (
            <section className="hero-card" aria-label="مميّز" style={{ background: toneFor(featured.id) }}>
              <span className="hero-card-scrim" />
              <span className="badge corner-tr">أُضيف حديثاً</span>
              <div className="row row-4 hero-card-row">
                <div className="grow stack-2 hero-card-body">
                  <h2 className="hero-card-title">{featured.name}</h2>
                  <div className="hero-card-meta">{[metaLine(featured, categories), featured.rating ? `★ ${featured.rating}` : ""].filter(Boolean).join(" · ")}</div>
                  <div className="row row-2">
                    <a className="btn btn-primary" href={detailHref(featured)}>
                      <Icon name="play" size={16} />
                      <span>{kind === "movie" ? "تشغيل" : "الحلقات"}</span>
                    </a>
                    <button type="button" className="btn btn-glass" onClick={() => toggleFavorite(kind, featured.id)} aria-pressed={isFavorite(kind, featured.id)}>
                      <Icon name={isFavorite(kind, featured.id) ? "check" : "plus"} size={16} />
                      <span>قائمتي</span>
                    </button>
                  </div>
                </div>
                {featured.poster && (
                  <div className="hero-card-poster">
                    <div className="poster">
                      <Media src={featured.poster} seed={featured.id} name={featured.name} />
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <SectionHead title="أُضيف حديثاً" link={{ href: href(`/browse/${base}?cat=recent`), label: "الكل" }} />
            <div className="grid grid-3">
              {fresh.slice(1, 7).map((m) => (
                <div key={m.id}>
                  <Poster id={m.id} title={m.name} image={m.poster} href={detailHref(m)} meta={metaLine(m, categories)} badge={m.rating ? `★ ${m.rating}` : undefined} caption="below" />
                </div>
              ))}
            </div>
          </section>

          {top.length > 0 && (
            <section>
              <SectionHead title="الأعلى تقييماً" />
              <div className="rail">
                {top.map((m, i) => (
                  <a key={m.id} className="tile rank-tile" href={detailHref(m)} aria-label={`${i + 1}. ${m.name}`}>
                    <div className="poster">
                      <Media src={m.poster} seed={m.id} name={m.name} />
                      <span className="rank">{i + 1}</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export function Movies() {
  return <CatalogLanding kind="movie" />;
}
