/**
 * محرك التشغيل: يختار الطريقة الأنسب للجهاز والرابط.
 * - m3u8: تشغيل أصلي حيث يدعمه الجهاز (Safari/iOS، Tizen، webOS)، وإلا hls.js.
 * - ts (بث مباشر): mpegts.js عبر MSE، وإلا تشغيل أصلي.
 * - ملفات (mp4/mkv…): تشغيل أصلي.
 * المكتبتان تُحمّلان عند الحاجة فقط حتى يبقى الإقلاع خفيفاً على التلفاز.
 */

export interface Track {
  id: number;
  label: string;
}

export interface Engine {
  destroy(): void;
  audioTracks(): Track[];
  setAudioTrack(id: number): void;
  audioTrack(): number;
  subtitleTracks(): Track[];
  setSubtitleTrack(id: number): void;
  subtitleTrack(): number;
}

export interface EngineOptions {
  live: boolean;
  onError(message: string): void;
  onTracks?(): void;
}

export function streamKind(url: string): "hls" | "ts" | "file" {
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".m3u8") || /[?&](type|output)=m3u8/i.test(url)) return "hls";
  if (path.endsWith(".ts")) return "ts";
  return "file";
}

/** صفحة https لا تستطيع تحميل وسائط http (المحتوى المختلط) — يحدث فقط عند تجربة التطبيق من المتصفح. */
export function mixedContentBlocked(url: string): boolean {
  return window.location.protocol === "https:" && /^http:\/\//i.test(url);
}

const LANGS: Record<string, string> = { ar: "العربية", ara: "العربية", en: "English", eng: "English", fr: "Français", fre: "Français", fra: "Français", tr: "Türkçe", tur: "Türkçe", hi: "हिन्दी", ur: "اردو" };

function trackLabel(name: string | undefined, lang: string | undefined, i: number): string {
  const l = (lang ?? "").toLowerCase();
  return name?.trim() || LANGS[l] || (l ? l.toUpperCase() : `مسار ${i + 1}`);
}

const NO_TRACKS = {
  audioTracks: () => [],
  setAudioTrack: () => undefined,
  audioTrack: () => -1,
};

/** مسارات الترجمة الأصلية (textTracks) للتشغيل الأصلي. */
function nativeSubtitles(video: HTMLVideoElement) {
  const list = () => Array.prototype.slice.call(video.textTracks || []).filter((t: TextTrack) => t.kind === "subtitles" || t.kind === "captions") as TextTrack[];
  return {
    subtitleTracks: () => list().map((t, i) => ({ id: i, label: trackLabel(t.label, t.language, i) })),
    setSubtitleTrack: (id: number) => list().forEach((t, i) => (t.mode = i === id ? "showing" : "disabled")),
    subtitleTrack: () => list().findIndex((t) => t.mode === "showing"),
  };
}

function attachNative(video: HTMLVideoElement, url: string, opts: EngineOptions): Engine {
  const onError = () => {
    const code = video.error?.code;
    opts.onError(code === 4 ? "صيغة هذا البث غير مدعومة على هذا الجهاز." : "تعذّر تشغيل البث. قد يكون الخادم مشغولاً أو الرابط منتهياً.");
  };
  video.addEventListener("error", onError);
  video.src = url;
  video.load();
  const onLoaded = () => opts.onTracks?.();
  video.addEventListener("loadedmetadata", onLoaded);
  return {
    destroy() {
      video.removeEventListener("error", onError);
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeAttribute("src");
      video.load();
    },
    ...NO_TRACKS,
    ...nativeSubtitles(video),
  };
}

export async function attachStream(video: HTMLVideoElement, url: string, opts: EngineOptions): Promise<Engine> {
  if (mixedContentBlocked(url)) {
    opts.onError("المتصفح يمنع تشغيل روابط http داخل صفحة https. شغّل هذا البث من تطبيق التلفاز أو الجوال.");
    return { destroy() {}, ...NO_TRACKS, subtitleTracks: () => [], setSubtitleTrack: () => undefined, subtitleTrack: () => -1 };
  }
  const kind = streamKind(url);

  if (kind === "hls" && video.canPlayType("application/vnd.apple.mpegurl") === "") {
    const { default: Hls } = await import("hls.js");
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, backBufferLength: opts.live ? 30 : 90, maxBufferLength: opts.live ? 20 : 45 });
      let networkRetries = 0;
      let mediaRecoveries = 0;
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && networkRetries < 3) {
          networkRetries++;
          window.setTimeout(() => hls.startLoad(), 1000 * networkRetries);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
          mediaRecoveries++;
          hls.recoverMediaError();
        } else {
          opts.onError(data.type === Hls.ErrorTypes.NETWORK_ERROR ? "انقطع الاتصال بخادم البث." : "تعذّر تشغيل هذا البث على هذا الجهاز.");
        }
      });
      hls.on(Hls.Events.MANIFEST_PARSED, () => opts.onTracks?.());
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => opts.onTracks?.());
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => opts.onTracks?.());
      hls.on(Hls.Events.FRAG_LOADED, () => {
        networkRetries = 0;
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      return {
        destroy: () => hls.destroy(),
        audioTracks: () => hls.audioTracks.map((t, i) => ({ id: i, label: trackLabel(t.name, t.lang, i) })),
        setAudioTrack: (id) => (hls.audioTrack = id),
        audioTrack: () => hls.audioTrack,
        subtitleTracks: () => hls.subtitleTracks.map((t, i) => ({ id: i, label: trackLabel(t.name, t.lang, i) })),
        setSubtitleTrack: (id) => (hls.subtitleTrack = id),
        subtitleTrack: () => hls.subtitleTrack,
      };
    }
  }

  if (kind === "ts") {
    const { default: mpegts } = await import("mpegts.js");
    if (mpegts.isSupported()) {
      const player = mpegts.createPlayer({ type: "mpegts", isLive: opts.live, url }, { enableWorker: true, lazyLoad: !opts.live, liveBufferLatencyChasing: opts.live, autoCleanupSourceBuffer: true });
      player.on(mpegts.Events.ERROR, (type: string) => {
        opts.onError(type === mpegts.ErrorTypes.NETWORK_ERROR ? "انقطع الاتصال بخادم البث." : "تعذّر تشغيل هذا البث على هذا الجهاز.");
      });
      player.attachMediaElement(video);
      player.load();
      return {
        destroy() {
          try {
            player.pause();
            player.unload();
            player.detachMediaElement();
          } finally {
            player.destroy();
          }
        },
        ...NO_TRACKS,
        subtitleTracks: () => [],
        setSubtitleTrack: () => undefined,
        subtitleTrack: () => -1,
      };
    }
  }

  return attachNative(video, url, opts);
}
