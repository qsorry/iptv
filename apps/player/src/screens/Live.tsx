import { useEffect, useMemo, useState } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary, useNow } from "../state/hooks";
import { useIncremental } from "../state/visibility";
import { href, navigate } from "../nav/router";
import { epgSlice } from "../catalog/epg";
import type { CatalogSource, Category, EpgEntry, LiveChannel } from "../catalog/types";
import { clock, count, CHANNELS } from "../lib/format";
import { Icon } from "../components/Icon";
import { ChannelLogo, Empty, ErrorState, Loading, Progress } from "../components/ui";
import { ChannelRow, liveHref, useNowNext } from "./common";

export const ALL = "all";
export const FAV = "fav";

/** قنوات تصنيف (أو الكل/المفضلة) بترتيب المزوّد. */
export function channelsIn(list: LiveChannel[], categoryId: string, favIds: string[]): LiveChannel[] {
  if (categoryId === ALL) return list;
  if (categoryId === FAV) {
    const byId = new Map(list.map((c) => [c.id, c]));
    return favIds.map((id) => byId.get(id)).filter((c): c is LiveChannel => !!c);
  }
  return list.filter((c) => c.categoryId === categoryId);
}

function CategoryChips({ categories, current, base }: { categories: Category[]; current: string; base: string }) {
  const chips = [{ id: ALL, name: "الكل" }, { id: FAV, name: "المفضلة" }, ...categories];
  return (
    <nav className="rail" aria-label="التصنيفات" data-nav-region="live-cats">
      {chips.map((c) => (
        <a key={c.id} className={`chip${c.id === current ? " is-on" : ""}`} href={href(`${base}?cat=${encodeURIComponent(c.id)}`)} aria-current={c.id === current ? "true" : undefined} onClick={(e) => {
          // استبدال لا إضافة: تبديل التصنيف لا يملأ سجل الرجوع.
          e.preventDefault();
          navigate(`${base}?cat=${encodeURIComponent(c.id)}`, { replace: true });
        }}>
          {c.name}
        </a>
      ))}
    </nav>
  );
}

export function Live({ wide, tv, categoryId }: { wide: boolean; tv: boolean; categoryId: string | null }) {
  const { source } = useActive();
  const { favorites } = useLibrary();
  const data = useAsync(async () => ({ categories: await source.categories("live"), channels: await source.liveChannels() }), [source]);
  const current = categoryId ?? ALL;
  // المفضلة تغيّر القائمة فقط في تصنيف «المفضلة»؛ وإلا تبقى القائمة (والتحديد والتمرير) كما هي عند الإضافة للمفضلة.
  const favKey = current === FAV ? favorites.live : null;
  const channels = useMemo(() => channelsIn(data.data?.channels ?? [], current, favKey ?? []), [data.data, current, favKey]);
  const catName = current === ALL ? "كل القنوات" : current === FAV ? "المفضلة" : (data.data?.categories.find((c) => c.id === current)?.name ?? "القنوات");

  if (data.loading && !data.data) return <div className="screen"><Loading /></div>;
  if (data.error) return <div className="screen"><ErrorState error={data.error} onRetry={data.reload} /></div>;

  return (
    <div className={`screen stack-5${wide ? " live-wide" : ""}`}>
      {!wide && (
        <header className="row">
          <h1 className="page-title grow">مباشر</h1>
          <a className="icon-btn" href={href("/guide")} aria-label="دليل البرامج">
            <Icon name="guide" size={20} />
          </a>
          <a className="icon-btn" href={href("/search")} aria-label="بحث">
            <Icon name="search" size={20} />
          </a>
        </header>
      )}
      <CategoryChips categories={data.data!.categories} current={current} base="/live" />
      {channels.length === 0 ? (
        <Empty title={current === FAV ? "لا قنوات مفضلة بعد" : "لا قنوات في هذا التصنيف"}>
          {current === FAV && <p>أضف قناة للمفضلة من شاشة التشغيل.</p>}
        </Empty>
      ) : wide ? (
        <LiveWide source={source} channels={channels} categoryId={current} catName={catName} tv={tv} />
      ) : (
        <LivePhone source={source} channels={channels} categoryId={current} />
      )}
    </div>
  );
}

function LivePhone({ source, channels, categoryId }: { source: CatalogSource; channels: LiveChannel[]; categoryId: string }) {
  const now = useNow();
  const { items, sentinel, hasMore } = useIncremental(channels);
  return (
    <div className="stack-3">
      {items.map((c) => (
        <ChannelRow key={c.id} source={source} channel={c} now={now} categoryId={categoryId} />
      ))}
      {hasMore && <div ref={sentinel} className="sentinel" />}
    </div>
  );
}

/** تخطيط التلفاز: معاينة القناة المحددة، قائمة القنوات، ودليل البرامج لما حولها. */
function LiveWide({ source, channels, categoryId, catName, tv }: { source: CatalogSource; channels: LiveChannel[]; categoryId: string; catName: string; tv: boolean }) {
  const now = useNow();
  const [selectedId, setSelectedId] = useState(channels[0].id);
  useEffect(() => setSelectedId((id) => (channels.some((c) => c.id === id) ? id : channels[0].id)), [channels]);
  const selected = channels.find((c) => c.id === selectedId) ?? channels[0];
  const epg = useNowNext(source, selected, now);
  const { isFavorite, toggleFavorite } = useLibrary();
  const { items, sentinel, hasMore } = useIncremental(channels, 40);
  const idx = channels.indexOf(selected);
  const around = channels.slice(Math.max(0, idx), Math.max(0, idx) + 3);

  return (
    <>
      <div className="live-top">
        <section className="live-preview" aria-label="القناة المحددة">
          <div className="row row-2">
            <span className="badge badge-live">مباشر</span>
            <span className="badge badge-soft">{catName}</span>
          </div>
          <div className="center live-preview-mid">
            <a className="play-circle" href={liveHref(selected, categoryId)} aria-label={`تشغيل ${selected.name}`}>
              <Icon name="play" size={30} />
            </a>
          </div>
          <div className="stack-2">
            <div className="row row-baseline">
              <div className="live-now-title truncate">{epg?.current?.title ?? selected.name}</div>
              <div className="muted truncate">
                {selected.name} · <span className="ltr">{selected.num}</span>
              </div>
            </div>
            {epg?.current ? (
              <div className="row ltr live-times">
                <span>{clock(epg.current.start)}</span>
                <Progress value={epg.progress} className="progress-thin grow" />
                <span>{clock(epg.current.end)}</span>
              </div>
            ) : (
              <div className="muted">لا يتوفر دليل برامج لهذه القناة.</div>
            )}
            <div className="row row-2">
              <a className="btn btn-primary" href={liveHref(selected, categoryId)}>
                <Icon name="play" size={16} />
                <span>تشغيل</span>
              </a>
              <button type="button" className="btn btn-secondary" onClick={() => toggleFavorite("live", selected.id)} aria-pressed={isFavorite("live", selected.id)}>
                <Icon name={isFavorite("live", selected.id) ? "check" : "heart"} size={16} />
                <span>{isFavorite("live", selected.id) ? "في المفضلة" : "المفضلة"}</span>
              </button>
            </div>
          </div>
        </section>

        <section className="live-list" aria-label={catName}>
          <div className="row">
            <h2 className="grow live-list-title">{catName}</h2>
            <div className="muted small">{count(channels.length, CHANNELS)}</div>
          </div>
          <div className="live-list-scroll stack-2" data-nav-region="live-list">
            {items.map((c, i) => (
              <a
                key={c.id}
                className={`channel-item${c.id === selected.id ? " is-current" : ""}`}
                href={liveHref(c, categoryId)}
                onFocus={() => setSelectedId(c.id)}
                onMouseEnter={() => !tv && setSelectedId(c.id)}
                data-autofocus={i === 0 || undefined}
              >
                <span className="num ltr">{c.num}</span>
                <ChannelLogo src={c.logo} name={c.name} small />
                <span className="grow">
                  <span className="name truncate" style={{ display: "block" }}>{c.name}</span>
                </span>
              </a>
            ))}
            {hasMore && <div ref={sentinel} className="sentinel" />}
          </div>
        </section>
      </div>

      <EpgGrid source={source} channels={around} now={now} />
    </>
  );
}

/** شبكة الدليل: ساعتان من بداية نصف الساعة الحالية، كل برنامج بعرض مدته. */
export function EpgGrid({ source, channels, now, rows = 3 }: { source: CatalogSource; channels: LiveChannel[]; now: number; rows?: number }) {
  const from = Math.floor(now / 1800000) * 1800000;
  const to = from + 4 * 1800000;
  const ticks = [0, 1, 2, 3].map((i) => clock(from + i * 1800000));
  return (
    <section className="epg" aria-label="دليل البرامج">
      <div className="epg-head">
        <h2 className="grow">دليل البرامج</h2>
        <div className="epg-scale ltr">
          {ticks.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      {channels.slice(0, rows).map((c) => (
        <EpgRow key={c.id} source={source} channel={c} from={from} to={to} now={now} />
      ))}
    </section>
  );
}

function EpgRow({ source, channel, from, to, now }: { source: CatalogSource; channel: LiveChannel; from: number; to: number; now: number }) {
  const [entries, setEntries] = useState<EpgEntry[] | null>(null);
  useEffect(() => {
    let alive = true;
    source.shortEpg(channel, 8).then(
      (l) => alive && setEntries(l),
      () => alive && setEntries([]),
    );
    return () => {
      alive = false;
    };
  }, [source, channel]);
  const slice = entries ? epgSlice(entries, from, to, now) : [];
  return (
    <div className="epg-row">
      <div className="epg-name truncate">{channel.name}</div>
      <div className="epg-strip ltr">
        {slice.length === 0 ? (
          <div className="epg-prog" style={{ WebkitBoxFlex: 1, flexGrow: 1 }}>{entries ? "لا يتوفر دليل" : "…"}</div>
        ) : (
          slice.map((p) => (
            <div key={p.entry.start} className={`epg-prog${p.live ? " is-live" : ""}`} style={{ WebkitBoxFlex: p.span, flexGrow: p.span }} title={p.entry.title}>
              {p.entry.title}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
