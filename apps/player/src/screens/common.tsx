import { useEffect, useState } from "react";
import { nowNext, type NowNext } from "../catalog/epg";
import type { CatalogSource, LiveChannel } from "../catalog/types";
import { clock, remaining } from "../lib/format";
import type { HistoryEntry } from "../lib/library";
import { href } from "../nav/router";
import { ChannelLogo, Progress, SectionHead, WideCard } from "../components/ui";
import { useVisible } from "../state/visibility";

/** البرنامج الحالي والتالي لقناة (يُجلب عند الظهور ويُحدَّث مع الساعة). */
export function useNowNext(source: CatalogSource, channel: LiveChannel | null | undefined, now: number, enabled = true): NowNext | null {
  const [entries, setEntries] = useState<Awaited<ReturnType<CatalogSource["shortEpg"]>> | null>(null);
  useEffect(() => {
    setEntries(null);
    if (!channel || !enabled) return;
    let alive = true;
    source.shortEpg(channel, 4).then(
      (list) => alive && setEntries(list),
      () => alive && setEntries([]),
    );
    return () => {
      alive = false;
    };
  }, [source, channel, enabled]);
  return entries ? nowNext(entries, now) : null;
}

export function liveHref(channel: LiveChannel, categoryId?: string | null) {
  return href(`/play/live/${encodeURIComponent(channel.id)}${categoryId ? `?cat=${encodeURIComponent(categoryId)}` : ""}`);
}

/** صف قناة كما في الرئيسية: الشعار، الاسم والرقم، الآن والتالي مع التقدم. */
export function ChannelRow({ source, channel, now, categoryId, autoFocus }: { source: CatalogSource; channel: LiveChannel; now: number; categoryId?: string | null; autoFocus?: boolean }) {
  // الدليل يُجلب فقط للصفوف الظاهرة؛ قائمة من آلاف القنوات لا ترسل آلاف الطلبات.
  const [ref, visible] = useVisible<HTMLAnchorElement>();
  const epg = useNowNext(source, channel, now, visible);
  return (
    <a ref={ref} className="channel-row" href={liveHref(channel, categoryId)} data-autofocus={autoFocus || undefined}>
      <ChannelLogo src={channel.logo} name={channel.name} />
      <div className="grow stack-1">
        <div className="row row-2">
          <div className="name grow truncate">{channel.name}</div>
          <div className="num ltr">{channel.num}</div>
        </div>
        <div className="now truncate">{epg?.current ? `الآن: ${epg.current.title}` : "بث مباشر"}</div>
        {epg?.current && <Progress value={epg.progress} className="progress-thin" />}
        {epg?.next && (
          <div className="next truncate">
            التالي <span className="ltr">{clock(epg.next.start)}</span> · {epg.next.title}
          </div>
        )}
      </div>
    </a>
  );
}

export function historyHref(e: HistoryEntry) {
  const t = `?t=${Math.floor(e.position)}`;
  if (e.kind === "episode" && e.seriesId) return href(`/play/episode/${encodeURIComponent(e.seriesId)}/${encodeURIComponent(e.itemId)}${t}`);
  if (e.kind === "movie") return href(`/play/movie/${encodeURIComponent(e.itemId)}${t}`);
  return href(`/play/live/${encodeURIComponent(e.itemId)}`);
}

export function episodeBadge(e: Pick<HistoryEntry, "season" | "episode">) {
  if (!e.episode) return undefined;
  return e.season && e.season > 1 ? `م${e.season} ح${e.episode}` : `ح ${e.episode}`;
}

export function ResumeRail({ items, wide }: { items: HistoryEntry[]; wide: boolean }) {
  if (items.length === 0) return null;
  return (
    <section>
      <SectionHead title="تابع المشاهدة" />
      <div className="rail" data-nav-region="resume">
        {items.slice(0, 12).map((e) => (
          <WideCard
            key={e.key}
            id={e.key}
            title={e.title}
            meta={wide ? undefined : remaining(e.position, e.duration)}
            state={wide ? remaining(e.position, e.duration) : undefined}
            image={e.image}
            href={historyHref(e)}
            progress={e.position / e.duration}
            badge={episodeBadge(e)}
            width={wide ? "15.625rem" : "9.875rem"}
          />
        ))}
      </div>
    </section>
  );
}
