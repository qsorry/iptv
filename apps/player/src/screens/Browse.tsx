import { useEffect, useMemo, useState } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary } from "../state/hooks";
import { useIncremental } from "../state/visibility";
import { href, navigate, goBack } from "../nav/router";
import type { Category, Movie, Series } from "../catalog/types";
import type { HistoryEntry } from "../lib/library";
import { count, ITEMS, thousands } from "../lib/format";
import { normalizeSearch } from "../lib/text";
import { Icon, BrandMark, type IconName } from "../components/Icon";
import { Empty, ErrorState, Loading, Poster } from "../components/ui";
import { newest } from "./Home";
import { detailHref, metaLine } from "./Movies";
import { episodeBadge } from "./common";

type Item = Movie | Series;
type Sort = "recent" | "name" | "rating";

const SORT_LABEL: Record<Sort, string> = { recent: "الأحدث", name: "الاسم", rating: "التقييم" };
const NEXT_SORT: Record<Sort, Sort> = { recent: "name", name: "rating", rating: "recent" };
/** عدد «أُضيف حديثاً». */
const RECENT_COUNT = 30;

interface Pinned {
  id: string;
  label: string;
  icon: IconName;
}

const PINNED: Pinned[] = [
  { id: "recent", label: "أُضيف حديثاً", icon: "recent" },
  { id: "all", label: "الكل", icon: "grid" },
  { id: "continue", label: "تكملة المشاهدة", icon: "resume" },
  { id: "fav", label: "المفضلة", icon: "heart" },
];

function sortItems(list: Item[], sort: Sort): Item[] {
  if (sort === "recent") return newest(list);
  if (sort === "rating") return list.slice().sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return list.slice().sort((a, b) => a.name.localeCompare(b.name, "ar"));
}

/** العناصر قيد المشاهدة: الأفلام مباشرة، والمسلسلات من آخر حلقة شوهدت. */
function continuing(items: Item[], history: HistoryEntry[], kind: "movie" | "series") {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out: { item: Item; entry: HistoryEntry }[] = [];
  const seen = new Set<string>();
  for (const e of history) {
    const id = kind === "movie" ? (e.kind === "movie" ? e.itemId : null) : e.kind === "episode" ? (e.seriesId ?? null) : null;
    if (!id || seen.has(id)) continue;
    const item = byId.get(id);
    if (!item) continue;
    seen.add(id);
    out.push({ item, entry: e });
  }
  return out;
}

export function Browse({ kind, wide, categoryId }: { kind: "movie" | "series"; wide: boolean; categoryId: string | null }) {
  const { source } = useActive();
  const { favorites, history } = useLibrary();
  const [sort, setSort] = useState<Sort>("recent");
  const [catQuery, setCatQuery] = useState("");
  const current = categoryId ?? "recent";
  const base = `/browse/${kind === "movie" ? "movie" : "series"}`;

  const data = useAsync(async () => {
    const [categories, items] = await Promise.all([source.categories(kind), kind === "movie" ? source.movies() : source.series()]);
    return { categories, items: items as Item[] };
  }, [source, kind]);

  const inProgress = useMemo(() => continuing(data.data?.items ?? [], history, kind), [data.data, history, kind]);
  const favIds = kind === "movie" ? favorites.movie : favorites.series;

  const view = useMemo(() => {
    const items = data.data?.items ?? [];
    if (current === "recent") return newest(items).slice(0, RECENT_COUNT);
    if (current === "continue") return inProgress.map((x) => x.item);
    if (current === "fav") {
      const byId = new Map(items.map((i) => [i.id, i]));
      return favIds.map((id) => byId.get(id)).filter((i): i is Item => !!i);
    }
    return sortItems(current === "all" ? items : items.filter((i) => i.categoryId === current), sort);
  }, [data.data, current, sort, inProgress, favIds]);

  const { items, sentinel, hasMore } = useIncremental(view, 50);

  // تبديل التصنيف يستبدل الرابط (لا يملأ سجل الرجوع) ويعيد الشبكة لأعلاها.
  const pick = (id: string) => navigate(`${base}?cat=${encodeURIComponent(id)}`, { replace: true });
  useEffect(() => {
    document.querySelector(".library-main")?.scrollTo(0, 0);
  }, [current]);

  if (data.loading && !data.data) return <div className="screen"><Loading /></div>;
  if (data.error) return <div className="screen"><ErrorState error={data.error} onRetry={data.reload} /></div>;
  const { categories } = data.data!;

  const counts: Record<string, number> = {
    recent: Math.min(RECENT_COUNT, data.data!.items.length),
    all: data.data!.items.length,
    continue: inProgress.length,
    fav: favIds.length,
  };
  const catCounts = new Map<string, number>();
  for (const i of data.data!.items) catCounts.set(i.categoryId, (catCounts.get(i.categoryId) ?? 0) + 1);
  const title = PINNED.find((p) => p.id === current)?.label ?? categories.find((c) => c.id === current)?.name ?? (kind === "movie" ? "أفلام" : "مسلسلات");
  const progressById = new Map(inProgress.map((x) => [x.item.id, x.entry]));
  const q = normalizeSearch(catQuery);
  const shownCats = q ? categories.filter((c) => normalizeSearch(c.name).includes(q)) : categories;

  const grid = view.length === 0 ? (
    <Empty title={current === "fav" ? "لا شيء في المفضلة بعد" : current === "continue" ? "لم تبدأ مشاهدة شيء بعد" : "لا يوجد محتوى هنا"} />
  ) : (
    <div className="grid" data-nav-region="library-grid">
      {items.map((item, i) => {
        const entry = progressById.get(item.id);
        const badge = current === "continue" && entry ? (kind === "series" ? episodeBadge(entry) : undefined) : item.rating ? `★ ${item.rating}` : item.year;
        return (
          <div key={item.id}>
            <Poster
              id={item.id}
              title={item.name}
              image={item.poster}
              href={detailHref(item)}
              meta={metaLine(item, categories)}
              badge={badge}
              isNew={current === "recent" && i < 5}
              progress={current === "continue" && entry ? entry.position / entry.duration : undefined}
              caption="inside"
              autoFocus={i === 0}
            />
          </div>
        );
      })}
      {hasMore && <div ref={sentinel} className="sentinel" />}
    </div>
  );

  const sortButton = !["recent", "continue", "fav"].includes(current) && (
    <button type="button" className="btn btn-secondary" onClick={() => setSort(NEXT_SORT[sort])} aria-label={`الترتيب: ${SORT_LABEL[sort]}`}>
      <Icon name="filter" size={16} />
      <span>{SORT_LABEL[sort]}</span>
    </button>
  );

  if (!wide) {
    return (
      <div className="screen stack-5">
        <header className="row">
          <button type="button" className="icon-btn icon-btn-bare" aria-label="رجوع" onClick={() => goBack(kind === "movie" ? "/movies" : "/series")}>
            <Icon name="back" size={24} />
          </button>
          <h1 className="page-title grow truncate">{title}</h1>
          {sortButton}
        </header>
        <nav className="rail" aria-label="التصنيفات">
          {[...PINNED, ...categories].map((c) => (
            <button key={c.id} type="button" className={`chip${c.id === current ? " is-on" : ""}`} onClick={() => pick(c.id)} aria-pressed={c.id === current}>
              {"label" in c ? c.label : c.name}
            </button>
          ))}
        </nav>
        <div className="muted small">{count(view.length, ITEMS)}</div>
        {grid}
      </div>
    );
  }

  return (
    <div className="library">
      <aside className="library-side" data-nav-region="library-side">
        <div className="row">
          <button type="button" className="icon-btn icon-btn-bare" aria-label="رجوع" onClick={() => goBack("/")}>
            <Icon name="back" size={24} />
          </button>
          <BrandMark size={36} />
          <div className="display ltr grow library-brand">Ssouq Net</div>
        </div>
        <div className="library-search">
          <label htmlFor="cat-search" className="sr-only">ابحث في التصنيفات</label>
          <input id="cat-search" className="input" placeholder="ابحث في التصنيفات" value={catQuery} onChange={(e) => setCatQuery(e.target.value)} />
          <Icon name="search" size={18} className="library-search-icon" />
        </div>
        <div className="library-cats">
          {PINNED.map((p) => (
            <CategoryButton key={p.id} active={p.id === current} label={p.label} count={counts[p.id]} icon={p.icon} onClick={() => pick(p.id)} big />
          ))}
          <div className="library-cats-label">التصنيفات</div>
          {shownCats.map((c: Category) => (
            <CategoryButton key={c.id} active={c.id === current} label={c.name} count={catCounts.get(c.id) ?? 0} onClick={() => pick(c.id)} />
          ))}
        </div>
      </aside>
      <section className="library-main">
        <div className="row library-head">
          <h1 className="grow truncate">{title}</h1>
          <div className="muted small">{count(view.length, ITEMS)}</div>
          {sortButton}
          <a className="icon-btn" href={href("/search")} aria-label="بحث">
            <Icon name="search" size={20} />
          </a>
        </div>
        {grid}
      </section>
    </div>
  );
}

function CategoryButton({ active, label, count: n, icon, onClick, big }: { active: boolean; label: string; count: number; icon?: IconName; onClick: () => void; big?: boolean }) {
  return (
    <button type="button" className={`cat-btn${active ? " is-active" : ""}${big ? " cat-btn-big" : ""}`} onClick={onClick} aria-pressed={active}>
      {icon && <Icon name={icon} size={20} />}
      <span className="grow truncate">{label}</span>
      <span className="ltr cat-count">{thousands(n)}</span>
    </button>
  );
}
