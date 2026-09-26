import { useMemo } from "react";
import { useActive } from "../state/session";
import { useAsync, useLayout, useLibrary, useNow } from "../state/hooks";
import { href } from "../nav/router";
import { Icon } from "../components/Icon";
import { ErrorState, Loading, Poster, SectionHead } from "../components/ui";
import { initial } from "../lib/format";
import { ChannelRow, ResumeRail } from "./common";
import type { LiveChannel } from "../catalog/types";

/** الرئيسية: تابع المشاهدة، القنوات المباشرة (المفضلة أولاً)، وما أُضيف حديثاً. */
export function Home({ wide }: { wide: boolean }) {
  const { account, source } = useActive();
  const { tv } = useLayout();
  const { resume, favorites, history } = useLibrary();
  const now = useNow();
  const live = useAsync(() => source.liveChannels(), [source]);
  const movies = useAsync(() => source.movies(), [source]);
  const series = useAsync(() => source.series(), [source]);

  const channels = useMemo(() => pickChannels(live.data ?? [], favorites.live, history.filter((h) => h.kind === "live").map((h) => h.itemId)), [live.data, favorites.live, history]);
  const freshMovies = useMemo(() => newest(movies.data ?? []).slice(0, 12), [movies.data]);
  const freshSeries = useMemo(() => newest(series.data ?? []).slice(0, 12), [series.data]);

  return (
    <div className="screen stack-6">
      <header className="row">
        <div className="grow">
          <div className="muted home-kicker">مرحباً بعودتك</div>
          <h1 className="home-title">ماذا نشاهد الليلة؟</h1>
        </div>
        {!wide && (
          <>
            <a className="icon-btn" href={href("/search")} aria-label="بحث">
              <Icon name="search" size={20} />
            </a>
            <a className="avatar" href={href("/settings")} aria-label="الحساب والإعدادات">
              {initial(account.name)}
            </a>
          </>
        )}
      </header>

      {!wide && (
        <nav className="rail" aria-label="اختصارات">
          <a className="chip chip-accent" href={href("/live")}>مباشر</a>
          <a className="chip" href={href("/movies")}>أفلام</a>
          <a className="chip" href={href("/series")}>مسلسلات</a>
          <a className="chip" href={href("/guide")}>الدليل</a>
        </nav>
      )}

      <ResumeRail items={resume} wide={wide} />

      <section>
        <SectionHead title="القنوات المباشرة" link={{ href: href("/guide"), label: "دليل البرامج" }} />
        {live.loading && !live.data ? (
          <Loading />
        ) : live.error ? (
          <ErrorState error={live.error} onRetry={live.reload} />
        ) : channels.length === 0 ? (
          <p className="muted">لا توجد قنوات مباشرة في هذا الاشتراك.</p>
        ) : (
          <div className={wide ? "grid-2col" : "stack-3"} data-nav-region="home-live">
            {channels.slice(0, wide ? 6 : 4).map((c, i) => (
              <ChannelRow key={c.id} source={source} channel={c} now={now} autoFocus={tv && resume.length === 0 && i === 0} />
            ))}
          </div>
        )}
      </section>

      {freshMovies.length > 0 && (
        <section>
          <SectionHead title="أفلام أُضيفت حديثاً" link={{ href: href("/browse/movie?cat=recent"), label: "الكل" }} />
          <div className="rail" data-nav-region="home-movies">
            {freshMovies.map((m) => (
              <div key={m.id} className="rail-poster">
                <Poster id={m.id} title={m.name} image={m.poster} href={href(`/movies/${encodeURIComponent(m.id)}`)} meta={m.year} badge={m.rating ? `★ ${m.rating}` : undefined} caption={wide ? "inside" : "below"} />
              </div>
            ))}
          </div>
        </section>
      )}

      {freshSeries.length > 0 && (
        <section>
          <SectionHead title="مسلسلات أُضيفت حديثاً" link={{ href: href("/browse/series?cat=recent"), label: "الكل" }} />
          <div className="rail" data-nav-region="home-series">
            {freshSeries.map((s) => (
              <div key={s.id} className="rail-poster">
                <Poster id={s.id} title={s.name} image={s.poster} href={href(`/series/${encodeURIComponent(s.id)}`)} meta={s.year} caption={wide ? "inside" : "below"} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** المفضلة أولاً، ثم آخر ما شوهد، ثم ترتيب المزوّد. */
function pickChannels(all: LiveChannel[], favIds: string[], recentIds: string[]): LiveChannel[] {
  const byId = new Map(all.map((c) => [c.id, c]));
  const out: LiveChannel[] = [];
  const seen = new Set<string>();
  for (const id of [...favIds, ...recentIds]) {
    const c = byId.get(id);
    if (c && !seen.has(id)) {
      out.push(c);
      seen.add(id);
    }
  }
  for (const c of all) {
    if (out.length >= 8) break;
    if (!seen.has(c.id)) out.push(c);
  }
  return out;
}

export function newest<T extends { added?: number }>(list: T[]): T[] {
  return list.slice().sort((a, b) => (b.added ?? 0) - (a.added ?? 0));
}
