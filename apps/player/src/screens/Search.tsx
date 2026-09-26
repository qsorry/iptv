import { useEffect, useMemo, useState } from "react";
import { useActive } from "../state/session";
import { useAsync } from "../state/hooks";
import { navigate } from "../nav/router";
import { normalizeSearch } from "../lib/text";
import { ChannelLogo, Empty, Loading, Poster, SectionHead } from "../components/ui";
import { detailHref } from "./Movies";
import { liveHref } from "./common";

const LIMIT = 30;

/** بحث محلي في القنوات والأفلام والمسلسلات (القوائم محمّلة في الذاكرة). */
export function Search({ wide, initial }: { wide: boolean; initial: string }) {
  const { source } = useActive();
  const [text, setText] = useState(initial);
  const [query, setQuery] = useState(initial);
  const data = useAsync(async () => {
    const [live, movies, series] = await Promise.all([source.liveChannels(), source.movies().catch(() => []), source.series().catch(() => [])]);
    return { live, movies, series };
  }, [source]);

  // تأخير قصير أثناء الكتابة، وحفظ النص في الرابط ليعود عند الرجوع من صفحة نتيجة.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setQuery(text);
      navigate(`/search${text ? `?q=${encodeURIComponent(text)}` : ""}`, { replace: true });
    }, 300);
    return () => window.clearTimeout(t);
  }, [text]);

  const results = useMemo(() => {
    const q = normalizeSearch(query);
    if (!data.data || q.length < 2) return null;
    const match = (name: string) => normalizeSearch(name).includes(q);
    return {
      live: data.data.live.filter((c) => match(c.name)).slice(0, LIMIT),
      movies: data.data.movies.filter((m) => match(m.name)).slice(0, LIMIT),
      series: data.data.series.filter((s) => match(s.name)).slice(0, LIMIT),
    };
  }, [data.data, query]);

  const total = results ? results.live.length + results.movies.length + results.series.length : 0;

  return (
    <div className="screen stack-6">
      <h1 className="page-title">بحث</h1>
      <div>
        <label htmlFor="q" className="sr-only">ابحث عن قناة أو فيلم أو مسلسل</label>
        <input id="q" className="input" type="search" placeholder="ابحث عن قناة أو فيلم أو مسلسل" value={text} onChange={(e) => setText(e.target.value)} data-autofocus autoComplete="off" />
      </div>
      {data.loading && !data.data ? (
        <Loading label="جارٍ تحميل القوائم…" />
      ) : !results ? (
        <p className="muted">اكتب حرفين على الأقل.</p>
      ) : total === 0 ? (
        <Empty title="لا نتائج">جرّب كلمة أخرى أو جزءاً من الاسم.</Empty>
      ) : (
        <>
          {results.live.length > 0 && (
            <section>
              <SectionHead title="القنوات" />
              <div className="rail" data-nav-region="search-live">
                {results.live.map((c) => (
                  <a key={c.id} className="channel-chip" href={liveHref(c)}>
                    <ChannelLogo src={c.logo} name={c.name} small />
                    <span className="truncate">{c.name}</span>
                  </a>
                ))}
              </div>
            </section>
          )}
          {[
            { key: "movies", title: "الأفلام", list: results.movies },
            { key: "series", title: "المسلسلات", list: results.series },
          ].map(
            (sec) =>
              sec.list.length > 0 && (
                <section key={sec.key}>
                  <SectionHead title={sec.title} />
                  <div className="rail" data-nav-region={`search-${sec.key}`}>
                    {sec.list.map((m) => (
                      <div key={m.id} className="rail-poster">
                        <Poster id={m.id} title={m.name} image={m.poster} href={detailHref(m)} meta={m.year} caption={wide ? "inside" : "below"} />
                      </div>
                    ))}
                  </div>
                </section>
              ),
          )}
        </>
      )}
    </div>
  );
}
