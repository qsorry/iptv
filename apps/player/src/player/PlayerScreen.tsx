import { useCallback, useEffect, useRef, useState } from "react";
import { useActive } from "../state/session";
import { useAsync, useLibrary, useNow, useSettings } from "../state/hooks";
import { useIncremental } from "../state/visibility";
import { goBack, navigate } from "../nav/router";
import { useRemote } from "../nav/remote";
import { focusFirst } from "../nav/focus";
import { getFavorites, recordHistory } from "../lib/library";
import { clock, timecode } from "../lib/format";
import type { CatalogSource, Episode, LiveChannel, LiveFormat, Movie, Series } from "../catalog/types";
import { Icon } from "../components/Icon";
import { ChannelLogo, ErrorState, Loading, Progress } from "../components/ui";
import { ALL, channelsIn } from "../screens/Live";
import { useNowNext } from "../screens/common";
import { attachStream, type Engine, type Track } from "./engine";

type Target =
  | { kind: "live"; url: string; title: string; channel: LiveChannel; list: LiveChannel[]; categoryId: string }
  | { kind: "movie"; url: string; title: string; movie: Movie }
  | { kind: "episode"; url: string; title: string; series: Series; episode: Episode; next?: Episode };

async function resolveTarget(source: CatalogSource, accountId: string, kind: string, id: string, extra: string | undefined, categoryId: string | null, format: LiveFormat): Promise<Target> {
  if (kind === "live") {
    const channels = await source.liveChannels();
    const channel = channels.find((c) => c.id === id);
    if (!channel) throw new Error("هذه القناة غير متوفرة الآن لدى مزوّدك.");
    const cat = categoryId ?? ALL;
    const list = channelsIn(channels, cat, getFavorites(accountId).live);
    return { kind, url: source.liveUrl(channel, format), title: channel.name, channel, list: list.length ? list : channels, categoryId: cat };
  }
  if (kind === "movie") {
    const movie = (await source.movies()).find((m) => m.id === id);
    if (!movie) throw new Error("هذا الفيلم غير متوفر الآن لدى مزوّدك.");
    return { kind, url: source.movieUrl(movie), title: movie.name, movie };
  }
  if (kind === "episode" && extra) {
    const series = (await source.series()).find((s) => s.id === id);
    if (!series) throw new Error("هذا المسلسل غير متوفر الآن لدى مزوّدك.");
    const info = await source.seriesInfo(series);
    const all = info.seasons.flatMap((s) => s.episodes);
    const idx = all.findIndex((e) => e.id === extra);
    if (idx < 0) throw new Error("هذه الحلقة غير متوفرة الآن.");
    return { kind, url: source.episodeUrl(all[idx]), title: series.name, series: info.series, episode: all[idx], next: all[idx + 1] };
  }
  throw new Error("رابط تشغيل غير صالح.");
}

function epTitle(ep: Episode) {
  return `${ep.season > 1 ? `الموسم ${ep.season} · ` : ""}الحلقة ${ep.episode}${ep.title && !/^الحلقة \d+$/.test(ep.title) ? ` — ${ep.title}` : ""}`;
}

export function PlayerScreen({ kind, id, extra, query, tv }: { kind: string; id: string; extra?: string; query: URLSearchParams; tv: boolean }) {
  const { account, source } = useActive();
  const [settings, updateSettings] = useSettings();
  const categoryId = query.get("cat");
  const target = useAsync(() => resolveTarget(source, account.id, kind, id, extra, categoryId, settings.liveFormat), [source, account.id, kind, id, extra, categoryId, settings.liveFormat]);

  if (target.loading && !target.data) {
    return (
      <div className="player" data-nav-scope>
        <Loading label="جارٍ التحضير…" />
      </div>
    );
  }
  if (target.error || !target.data) {
    return (
      <div className="player player-message" data-nav-scope>
        <ErrorState error={target.error ?? "تعذّر التشغيل"} onRetry={target.reload} />
        <button type="button" className="btn btn-secondary" onClick={() => goBack()}>
          رجوع
        </button>
      </div>
    );
  }
  return <Playback key={target.data.url} target={target.data} tv={tv} startAt={Number(query.get("t")) || 0} liveFormat={settings.liveFormat} onToggleFormat={() => updateSettings({ liveFormat: settings.liveFormat === "m3u8" ? "ts" : "m3u8" })} autoplayNext={settings.autoplayNext} />;
}

type Panel = null | "channels" | "tracks";

function Playback({ target, tv, startAt, liveFormat, onToggleFormat, autoplayNext }: { target: Target; tv: boolean; startAt: number; liveFormat: LiveFormat; onToggleFormat: () => void; autoplayNext: boolean }) {
  const { account, source } = useActive();
  const { isFavorite, toggleFavorite } = useLibrary();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const saveRef = useRef<(video?: HTMLVideoElement | null) => void>(() => undefined);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const [visible, setVisible] = useState(true);
  const [panel, setPanel] = useState<Panel>(null);
  const [tracks, setTracks] = useState<{ audio: Track[]; subs: Track[] }>({ audio: [], subs: [] });
  const hideTimer = useRef(0);
  const now = useNow(15000);
  const live = target.kind === "live";
  const epg = useNowNext(source, live ? target.channel : null, now);

  // ── تشغيل المصدر ──
  useEffect(() => {
    const video = videoRef.current!;
    let alive = true;
    setError(null);
    setBuffering(true);
    attachStream(video, target.url, {
      live,
      onError: (msg) => alive && setError(msg),
      onTracks: () => {
        const e = engineRef.current;
        if (alive && e) setTracks({ audio: e.audioTracks(), subs: e.subtitleTracks() });
      },
    }).then((engine) => {
      if (!alive) return engine.destroy();
      engineRef.current = engine;
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => setPaused(true));
    }, (e: unknown) => alive && setError(e instanceof Error ? e.message : "تعذّر التشغيل"));
    return () => {
      alive = false;
      // الحفظ قبل الإيقاف: destroy يفرّغ الفيديو، وvideoRef يُفصل قبل التنظيف عند إغلاق الشاشة.
      saveRef.current(video);
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [target.url, live, attempt]);

  // ── الاستئناف وحفظ التقدم ──
  const save = useCallback((video?: HTMLVideoElement | null) => {
    const v = video ?? videoRef.current;
    if (!v || live || !(v.duration > 0) || !isFinite(v.duration)) return;
    if (target.kind === "movie") {
      recordHistory(account.id, { key: `movie:${target.movie.id}`, kind: "movie", itemId: target.movie.id, title: target.movie.name, image: target.movie.poster, position: v.currentTime, duration: v.duration });
    } else if (target.kind === "episode") {
      const ep = target.episode;
      recordHistory(account.id, { key: `episode:${ep.id}`, kind: "episode", itemId: ep.id, title: target.series.name, subtitle: ep.title, image: ep.image ?? target.series.poster, seriesId: target.series.id, season: ep.season, episode: ep.episode, position: v.currentTime, duration: v.duration });
    }
  }, [account.id, live, target]);
  saveRef.current = save;

  useEffect(() => {
    if (live && target.kind === "live") {
      const c = target.channel;
      recordHistory(account.id, { key: `live:${c.id}`, kind: "live", itemId: c.id, title: c.name, image: c.logo, position: 0, duration: 0 });
    }
  }, [account.id, live, target]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) save();
    }, 10000);
    return () => {
      window.clearInterval(t);
      save();
    };
  }, [save]);

  // ── الشاشة تبقى مضاءة أثناء التشغيل (جوال) ──
  useEffect(() => {
    type WakeLock = { release(): Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request(type: "screen"): Promise<WakeLock> } };
    let lock: WakeLock | null = null;
    nav.wakeLock?.request("screen").then((l) => (lock = l), () => undefined);
    return () => {
      lock?.release().catch(() => undefined);
    };
  }, []);

  // ── إظهار/إخفاء أدوات التحكم ──
  const poke = useCallback(() => {
    setVisible(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setVisible(false);
    }, 4500);
  }, []);
  useEffect(() => {
    poke();
    return () => window.clearTimeout(hideTimer.current);
  }, [poke]);
  useEffect(() => {
    if (!tv || !visible || panel) return;
    const t = window.setTimeout(() => {
      const active = document.activeElement;
      if (!active || active === document.body || !document.querySelector(".player")?.contains(active)) focusFirst();
    }, 30);
    return () => window.clearTimeout(t);
  }, [tv, visible, panel]);

  // ── أوامر ──
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play()?.catch(() => undefined);
    else v.pause();
    poke();
  }, [poke]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v || live || !(v.duration > 0)) return;
      v.currentTime = Math.max(0, Math.min(v.duration - 1, v.currentTime + delta));
      poke();
    },
    [live, poke],
  );

  const zap = useCallback(
    (delta: number) => {
      if (target.kind !== "live") return;
      const i = target.list.findIndex((c) => c.id === target.channel.id);
      const next = target.list[(i + delta + target.list.length) % target.list.length];
      if (next && next.id !== target.channel.id) navigate(`/play/live/${encodeURIComponent(next.id)}?cat=${encodeURIComponent(target.categoryId)}`, { replace: true });
    },
    [target],
  );

  const playNext = useCallback(() => {
    if (target.kind === "episode" && target.next) {
      save();
      navigate(`/play/episode/${encodeURIComponent(target.series.id)}/${encodeURIComponent(target.next.id)}`, { replace: true });
    }
  }, [save, target]);

  useRemote((action) => {
    if (action === "back") {
      if (panel) setPanel(null);
      else goBack();
      return true;
    }
    if (panel) return false;
    switch (action) {
      case "playpause":
        togglePlay();
        return true;
      case "play":
        void videoRef.current?.play()?.catch(() => undefined);
        poke();
        return true;
      case "pause":
        videoRef.current?.pause();
        poke();
        return true;
      case "stop":
        goBack();
        return true;
      case "ff":
        seekBy(30);
        return true;
      case "rw":
        seekBy(-30);
        return true;
      case "chup":
        zap(1);
        return true;
      case "chdown":
        zap(-1);
        return true;
    }
    if (!visible) {
      // الأدوات مخفية: الأسهم تقدّم/تؤخر (أفلام) أو تبدّل القناة (مباشر)، وOK يظهر الأدوات.
      if (action === "right") return live ? (poke(), true) : (seekBy(10), true);
      if (action === "left") return live ? (poke(), true) : (seekBy(-10), true);
      if (action === "up") return live ? (zap(1), true) : (poke(), true);
      if (action === "down") return live ? (zap(-1), true) : (poke(), true);
      poke();
      return true;
    }
    poke();
    return false;
  });

  const onTimeUpdate = () => {
    const v = videoRef.current!;
    setTime({ current: v.currentTime, duration: isFinite(v.duration) ? v.duration : 0 });
  };

  const onEnded = () => {
    save();
    if (target.kind === "episode" && target.next && autoplayNext) playNext();
    else setVisible(true);
  };

  const onLoadedMetadata = () => {
    const v = videoRef.current!;
    if (startAt > 0 && !live && isFinite(v.duration) && startAt < v.duration - 5) v.currentTime = startAt;
    const e = engineRef.current;
    if (e) setTracks({ audio: e.audioTracks(), subs: e.subtitleTracks() });
  };

  const seekClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !(v.duration > 0)) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = ((e.clientX - r.left) / r.width) * v.duration;
    poke();
  };

  const fav = target.kind === "live" ? isFavorite("live", target.channel.id) : false;
  const nearEnd = target.kind === "episode" && !!target.next && time.duration > 60 && time.duration - time.current < 25;
  const hasTracks = tracks.audio.length > 1 || tracks.subs.length > 0;
  const subtitle = target.kind === "live" ? `${target.channel.num} · ${epg?.current?.title ?? "بث مباشر"}` : target.kind === "episode" ? epTitle(target.episode) : (target.movie.year ?? "");

  return (
    <div className={`player${visible ? " chrome-on" : ""}`} data-nav-scope onMouseMove={poke} onClick={(e) => e.target === videoRef.current && (visible ? togglePlay() : poke())}>
      <video
        ref={videoRef}
        className="player-video"
        autoPlay
        playsInline
        onPlay={() => setPaused(false)}
        onPause={() => {
          setPaused(true);
          setVisible(true);
          save();
        }}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />

      {buffering && !error && (
        <div className="player-center" aria-hidden="true">
          <div className="spinner" />
        </div>
      )}

      {error && (
        <div className="player-error stack-5" role="alert">
          <Icon name="alert" size={40} />
          <h2>{error}</h2>
          <div className="row row-2 row-wrap center">
            <button type="button" className="btn btn-primary" onClick={() => setAttempt((a) => a + 1)} data-autofocus>
              <Icon name="refresh" size={18} />
              <span>إعادة المحاولة</span>
            </button>
            {live && source.liveUrl(target.channel, liveFormat) !== source.liveUrl(target.channel, liveFormat === "m3u8" ? "ts" : "m3u8") && (
              <button type="button" className="btn btn-secondary" onClick={onToggleFormat}>
                جرّب صيغة {liveFormat === "m3u8" ? "TS" : "HLS"}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => goBack()}>
              رجوع
            </button>
          </div>
        </div>
      )}

      {visible && !error && (
        <>
          <div className="player-top">
            <button type="button" className="icon-btn icon-btn-bare" aria-label="رجوع" onClick={() => goBack()}>
              <Icon name="back" size={26} />
            </button>
            {target.kind === "live" && <ChannelLogo src={target.channel.logo} name={target.channel.name} small />}
            <div className="grow">
              <div className="player-title truncate">{target.title}</div>
              <div className="player-sub truncate">{subtitle}</div>
            </div>
            {!tv && <FullscreenButton />}
            {target.kind === "live" && (
              <button type="button" className="icon-btn icon-btn-bare" aria-label={fav ? "إزالة من المفضلة" : "إضافة للمفضلة"} aria-pressed={fav} onClick={() => toggleFavorite("live", target.channel.id)}>
                <Icon name={fav ? "check" : "heart"} size={22} />
              </button>
            )}
          </div>

          <div className="player-bottom stack-3">
            {live ? (
              <div className="row ltr player-times">
                <span className="badge badge-live">مباشر</span>
                {epg?.current ? (
                  <>
                    <span>{clock(epg.current.start)}</span>
                    <Progress value={epg.progress} className="progress-thin grow" />
                    <span>{clock(epg.current.end)}</span>
                  </>
                ) : (
                  <span className="grow" />
                )}
              </div>
            ) : (
              <div className="row ltr player-times">
                <span>{timecode(time.current)}</span>
                <div className="player-seek grow" onClick={seekClick} role="presentation">
                  <Progress value={time.duration ? time.current / time.duration : 0} />
                </div>
                <span>{time.duration ? timecode(time.duration) : "--:--"}</span>
              </div>
            )}
            {live && epg?.next && (
              <div className="player-next muted">
                التالي <span className="ltr">{clock(epg.next.start)}</span> · {epg.next.title}
              </div>
            )}
            {/* أزرار النقل باتجاه الشريط الزمني (يسار→يمين): الرجوع يساراً والتقديم يميناً. */}
            <div className="row row-2 center player-controls ltr">
              {live ? (
                <button type="button" className="icon-btn" aria-label="القناة السابقة" onClick={() => zap(-1)}>
                  <Icon name="prev" size={22} />
                </button>
              ) : (
                <button type="button" className="icon-btn" aria-label="رجوع 10 ثوانٍ" onClick={() => seekBy(-10)}>
                  <Icon name="rw" size={22} />
                </button>
              )}
              <button type="button" className="icon-btn player-play" aria-label={paused ? "تشغيل" : "إيقاف مؤقت"} onClick={togglePlay} data-autofocus>
                <Icon name={paused ? "play" : "pause"} size={26} />
              </button>
              {live ? (
                <button type="button" className="icon-btn" aria-label="القناة التالية" onClick={() => zap(1)}>
                  <Icon name="next" size={22} />
                </button>
              ) : (
                <button type="button" className="icon-btn" aria-label="تقديم 10 ثوانٍ" onClick={() => seekBy(10)}>
                  <Icon name="ff" size={22} />
                </button>
              )}
              {live && (
                <button type="button" className="btn btn-secondary" onClick={() => setPanel("channels")}>
                  <Icon name="list" size={18} />
                  <span>القنوات</span>
                </button>
              )}
              {target.kind === "episode" && target.next && (
                <button type="button" className="btn btn-secondary" onClick={playNext}>
                  <Icon name="next" size={18} />
                  <span>الحلقة التالية</span>
                </button>
              )}
              {hasTracks && (
                <button type="button" className="btn btn-secondary" onClick={() => setPanel("tracks")}>
                  <Icon name="audio" size={18} />
                  <span>الصوت والترجمة</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {nearEnd && !visible && !error && target.kind === "episode" && target.next && (
        <div className="player-upnext">
          <button type="button" className="btn btn-primary" onClick={playNext}>
            <Icon name="next" size={18} />
            <span>الحلقة التالية: {target.next.episode}</span>
          </button>
        </div>
      )}

      {panel === "channels" && target.kind === "live" && <ChannelPanel list={target.list} currentId={target.channel.id} categoryId={target.categoryId} onClose={() => setPanel(null)} />}
      {panel === "tracks" && engineRef.current && <TracksPanel engine={engineRef.current} tracks={tracks} onClose={() => setPanel(null)} />}
    </div>
  );
}

function FullscreenButton() {
  const toggle = () => {
    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => void };
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      (document.exitFullscreen ?? doc.webkitExitFullscreen)?.call(document);
      return;
    }
    const req = el.requestFullscreen ?? el.webkitRequestFullscreen;
    Promise.resolve(req?.call(el))
      .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.("landscape"))
      .catch(() => undefined);
  };
  return (
    <button type="button" className="icon-btn icon-btn-bare" aria-label="ملء الشاشة" onClick={toggle}>
      <Icon name="expand" size={22} />
    </button>
  );
}

/** قائمة جانبية للقنوات أثناء المشاهدة. */
function ChannelPanel({ list, currentId, categoryId, onClose }: { list: LiveChannel[]; currentId: string; categoryId: string; onClose: () => void }) {
  const { items, sentinel, hasMore } = useIncremental(list, 50);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>(".is-current") ?? ref.current?.querySelector<HTMLElement>("a");
    el?.focus();
    el?.scrollIntoView?.({ block: "center" });
  }, []);
  return (
    <div className="player-panel" data-nav-scope role="dialog" aria-label="القنوات">
      <div className="row player-panel-head">
        <h2 className="grow">القنوات</h2>
        <button type="button" className="icon-btn icon-btn-bare" aria-label="إغلاق" onClick={onClose}>
          <Icon name="back" size={22} />
        </button>
      </div>
      <div className="player-panel-list stack-2" ref={ref}>
        {items.map((c) => (
          <a
            key={c.id}
            className={`channel-item${c.id === currentId ? " is-current" : ""}`}
            href={`#/play/live/${encodeURIComponent(c.id)}?cat=${encodeURIComponent(categoryId)}`}
            onClick={(e) => {
              e.preventDefault();
              onClose();
              if (c.id !== currentId) navigate(`/play/live/${encodeURIComponent(c.id)}?cat=${encodeURIComponent(categoryId)}`, { replace: true });
            }}
          >
            <span className="num ltr">{c.num}</span>
            <ChannelLogo src={c.logo} name={c.name} small />
            <span className="name grow truncate">{c.name}</span>
          </a>
        ))}
        {hasMore && <div ref={sentinel} className="sentinel" />}
      </div>
    </div>
  );
}

function TracksPanel({ engine, tracks, onClose }: { engine: Engine; tracks: { audio: Track[]; subs: Track[] }; onClose: () => void }) {
  const [audio, setAudio] = useState(engine.audioTrack());
  const [sub, setSub] = useState(engine.subtitleTrack());
  useEffect(() => {
    const t = window.setTimeout(() => focusFirst(), 30);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="player-panel" data-nav-scope role="dialog" aria-label="الصوت والترجمة">
      <div className="row player-panel-head">
        <h2 className="grow">الصوت والترجمة</h2>
        <button type="button" className="icon-btn icon-btn-bare" aria-label="إغلاق" onClick={onClose}>
          <Icon name="back" size={22} />
        </button>
      </div>
      <div className="player-panel-list stack-5">
        {tracks.audio.length > 1 && (
          <div className="stack-2">
            <div className="muted">الصوت</div>
            {tracks.audio.map((t) => (
              <button key={t.id} type="button" className={`track-btn${t.id === audio ? " is-on" : ""}`} aria-pressed={t.id === audio} data-autofocus={t.id === audio || undefined} onClick={() => { engine.setAudioTrack(t.id); setAudio(t.id); }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        {tracks.subs.length > 0 && (
          <div className="stack-2">
            <div className="muted">الترجمة</div>
            <button type="button" className={`track-btn${sub < 0 ? " is-on" : ""}`} aria-pressed={sub < 0} onClick={() => { engine.setSubtitleTrack(-1); setSub(-1); }}>
              بدون ترجمة
            </button>
            {tracks.subs.map((t) => (
              <button key={t.id} type="button" className={`track-btn${t.id === sub ? " is-on" : ""}`} aria-pressed={t.id === sub} onClick={() => { engine.setSubtitleTrack(t.id); setSub(t.id); }}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
