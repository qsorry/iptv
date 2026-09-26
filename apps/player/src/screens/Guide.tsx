import { useMemo } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary, useNow } from "../state/hooks";
import { useIncremental } from "../state/visibility";
import { href, navigate } from "../nav/router";
import { Empty, ErrorState, Loading } from "../components/ui";
import { ChannelRow } from "./common";
import { ALL, FAV, EpgGrid, channelsIn } from "./Live";

/** دليل البرامج: شبكة زمنية على الشاشات العريضة، و«الآن/التالي» لكل قناة على الجوال. */
export function Guide({ wide, categoryId }: { wide: boolean; categoryId: string | null }) {
  const { source } = useActive();
  const { favorites } = useLibrary();
  const now = useNow();
  const data = useAsync(async () => ({ categories: await source.categories("live"), channels: await source.liveChannels() }), [source]);
  const current = categoryId ?? ALL;
  const favKey = current === FAV ? favorites.live : null;
  const channels = useMemo(() => channelsIn(data.data?.channels ?? [], current, favKey ?? []), [data.data, current, favKey]);
  const { items, sentinel, hasMore } = useIncremental(channels, 20);

  if (data.loading && !data.data) return <div className="screen"><Loading /></div>;
  if (data.error) return <div className="screen"><ErrorState error={data.error} onRetry={data.reload} /></div>;

  const chips = [{ id: ALL, name: "الكل" }, { id: FAV, name: "المفضلة" }, ...data.data!.categories];
  return (
    <div className="screen stack-5">
      <h1 className="page-title">دليل البرامج</h1>
      <nav className="rail" aria-label="التصنيفات" data-nav-region="guide-cats">
        {chips.map((c) => (
          <button key={c.id} type="button" className={`chip${c.id === current ? " is-on" : ""}`} aria-pressed={c.id === current} onClick={() => navigate(`/guide?cat=${encodeURIComponent(c.id)}`, { replace: true })}>
            {c.name}
          </button>
        ))}
      </nav>
      {channels.length === 0 ? (
        <Empty title="لا قنوات هنا" />
      ) : wide ? (
        <div data-nav-region="guide-grid">
          <EpgGrid source={source} channels={items} now={now} rows={items.length} />
          {hasMore && <div ref={sentinel} className="sentinel" />}
          <p className="muted small">اختر قناة من <a href={href(`/live?cat=${encodeURIComponent(current)}`)}>مباشر</a> لمشاهدتها.</p>
        </div>
      ) : (
        <div className="stack-3">
          {items.map((c) => (
            <ChannelRow key={c.id} source={source} channel={c} now={now} categoryId={current} />
          ))}
          {hasMore && <div ref={sentinel} className="sentinel" />}
        </div>
      )}
    </div>
  );
}
