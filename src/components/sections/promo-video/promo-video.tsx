"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  PROMO_DURATION_MS,
  ctaRect,
  renderFrame,
  sceneAt,
  type Backdrop,
  type PromoPalette,
  type PromoScript,
  type SceneKey,
} from "./promo-renderer";

export type PromoAspect = "landscape" | "portrait";

export interface PromoVideoProps {
  /** نصوص الفيديو؛ ما لم يُمرَّر يُستخدم النص الافتراضي لاشتراكات IPTV. */
  script?: Partial<PromoScript>;
  /** رابط زر الدعوة للإجراء (يظهر كرابط حقيقي فوق الكانفاس). */
  ctaHref: string;
  aspect?: PromoAspect;
  autoPlay?: boolean;
  loop?: boolean;
  /** شريط تحكم (تشغيل/إيقاف، إعادة، تصدير). للواجهة النهائية غالباً `false`. */
  controls?: boolean;
  /** فيديو خلفية اختياري (mp4/webm) يُرسم تحت المؤثرات. */
  videoSrc?: string;
  className?: string;
}

export const DEFAULT_PROMO_SCRIPT: PromoScript = {
  brand: "اشتراك IPTV الرقمي",
  title: "العالم كلّه على شاشتك",
  tagline: "أفلام · مسلسلات · رياضة مباشرة · بجودة سينمائية",
  features: [
    { headline: "4K", caption: "جودة فائقة الوضوح بلا تقطيع", icon: "uhd" },
    { headline: "آلاف القنوات", caption: "عربية وعالمية ورياضية في مكان واحد", icon: "channels" },
    { headline: "تفعيل فوري", caption: "يصلك الاشتراك خلال دقائق من الدفع", icon: "bolt" },
  ],
  ctaLabel: "اشترك الآن",
  channelsCount: 12000,
};

/** يحلّ رمزاً دلالياً إلى لون rgb() فعلي عبر عنصر مسبار (يدعم color-mix). */
function resolveToken(probe: HTMLElement, token: string): string {
  probe.style.color = `var(${token})`;
  return getComputedStyle(probe).color;
}

function readPalette(probe: HTMLElement): PromoPalette {
  const cs = getComputedStyle(probe);
  return {
    primary: resolveToken(probe, "--brand-primary"),
    secondary: resolveToken(probe, "--brand-secondary"),
    accent: resolveToken(probe, "--brand-accent"),
    ink: resolveToken(probe, "--text-primary"),
    onBrand: resolveToken(probe, "--text-on-brand"),
    surface: resolveToken(probe, "--surface-primary"),
    badgeText: resolveToken(probe, "--badge-text"),
    fontFamily: cs.getPropertyValue("--font-family").trim() || "sans-serif",
  };
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

/**
 * فيديو ترويجي مولّد بالكود (Canvas 2D): جسيمات، مسح ضوئي، عنوان يركّز بحدة،
 * شرائح مزايا متوهّجة (4K / آلاف القنوات / تفعيل فوري) ودعوة للإجراء.
 * مكوّن مستقل: لا يجلب بيانات ولا يعرف الثيم (الألوان من الرموز الدلالية المحلولة).
 * الحركة تحترم prefers-reduced-motion (إطار ثابت + تشغيل يدوي).
 */
export function PromoVideo({ script, ctaHref, aspect = "landscape", autoPlay = true, loop = true, controls = true, videoSrc, className }: PromoVideoProps) {
  const full = useMemo<PromoScript>(() => ({ ...DEFAULT_PROMO_SCRIPT, ...script, features: script?.features ?? DEFAULT_PROMO_SCRIPT.features }), [script]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const paletteRef = useRef<PromoPalette | null>(null);
  const timeRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  const playingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [scene, setScene] = useState<SceneKey>("intro");
  const [reduced, setReduced] = useState(false);
  const [exporting, setExporting] = useState<{ pct: number } | null>(null);
  const [exportUrl, setExportUrl] = useState<{ url: string; ext: string } | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const w = aspect === "portrait" ? 720 : 1280;
  const h = aspect === "portrait" ? 1280 : 720;

  const draw = useCallback(
    (ms: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      if (!paletteRef.current && probeRef.current) paletteRef.current = readPalette(probeRef.current);
      const pal = paletteRef.current;
      if (!pal) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const v = videoRef.current;
      const backdrop: Backdrop | undefined = v && v.readyState >= 2 ? { source: v, width: v.videoWidth, height: v.videoHeight } : undefined;
      renderFrame(ctx, w, h, ms, pal, full, { aspect, backdrop });
      const s = sceneAt(ms);
      setScene((prev) => (prev === s ? prev : s));
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${(ms % PROMO_DURATION_MS) / PROMO_DURATION_MS})`;
    },
    [w, h, full, aspect],
  );

  const stop = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    cancelAnimationFrame(rafRef.current);
    lastTsRef.current = null;
    videoRef.current?.pause();
  }, []);

  const play = useCallback(() => {
    if (playingRef.current) return;
    playingRef.current = true;
    setPlaying(true);
    void videoRef.current?.play().catch(() => undefined);
    const tick = (ts: number) => {
      if (!playingRef.current) return;
      const last = lastTsRef.current ?? ts;
      lastTsRef.current = ts;
      let next = timeRef.current + Math.min(64, ts - last);
      if (next >= PROMO_DURATION_MS) {
        if (!loop) {
          timeRef.current = PROMO_DURATION_MS - 1;
          draw(timeRef.current);
          stop();
          return;
        }
        next %= PROMO_DURATION_MS;
      }
      timeRef.current = next;
      draw(next);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [draw, loop, stop]);

  const replay = useCallback(() => {
    timeRef.current = 0;
    draw(0);
    if (!playingRef.current) play();
  }, [draw, play]);

  // الخطوط + reduced-motion + التشغيل الأولي.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    let cancelled = false;
    const fam = probeRef.current ? getComputedStyle(probeRef.current).getPropertyValue("--font-family") : "";
    const fontsReady =
      typeof document.fonts?.load === "function"
        ? Promise.all([document.fonts.load(`700 40px ${fam}`), document.fonts.load(`900 40px ${fam}`)]).catch(() => undefined)
        : Promise.resolve();
    void fontsReady.then(() => {
      if (cancelled) return;
      paletteRef.current = null;
      if (mq.matches) {
        // إطار ثابت من مشهد الدعوة للإجراء بدل الحركة.
        timeRef.current = PROMO_DURATION_MS - 1200;
        draw(timeRef.current);
      } else {
        draw(0);
        if (autoPlay) play();
      }
    });
    return () => {
      cancelled = true;
      mq.removeEventListener("change", onChange);
      stop();
    };
    // يُعاد التشغيل فقط عند تغيّر نسبة العرض؛ باقي القيم تُقرأ عبر refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect]);

  // إيقاف عند خروج التبويب أو خروج العنصر من الشاشة (توفير بطارية).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let wasPlaying = false;
    const io = new IntersectionObserver(([e]) => {
      if (!e) return;
      if (!e.isIntersecting && playingRef.current) {
        wasPlaying = true;
        stop();
      } else if (e.isIntersecting && wasPlaying && !reduced) {
        wasPlaying = false;
        play();
      }
    });
    io.observe(canvas);
    const onVis = () => {
      if (document.hidden && playingRef.current) {
        wasPlaying = true;
        stop();
      } else if (!document.hidden && wasPlaying && !reduced) {
        wasPlaying = false;
        play();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [play, stop, reduced]);

  // إعادة قراءة اللوحة عند تبديل وضع الزائر (فاتح/داكن).
  useEffect(() => {
    const mo = new MutationObserver(() => {
      paletteRef.current = null;
      if (!playingRef.current) draw(timeRef.current);
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const scope = probeRef.current?.closest("[data-theme-scope]");
    if (scope) mo.observe(scope, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, [draw]);

  useEffect(
    () => () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl.url);
    },
    [exportUrl],
  );

  /** تصدير حلقة كاملة كملف فيديو (WebM) عبر MediaRecorder. */
  const exportVideo = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || exporting) return;
    const mime = pickMime();
    if (!mime || typeof canvas.captureStream !== "function") {
      setExportError("المتصفح لا يدعم تسجيل الكانفاس. جرّب Chrome أو Edge.");
      return;
    }
    setExportError(null);
    setExportUrl(null);
    stop();
    setExporting({ pct: 0 });
    const fps = 30;
    const stream = canvas.captureStream(fps);
    const chunks: Blob[] = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const done = new Promise<void>((resolve) => {
      rec.onstop = () => resolve();
    });
    rec.start(250);
    // نرسم بزمن ثابت لكل إطار حتى يكون الملف الناتج سلساً بغض النظر عن أداء الجهاز.
    const frames = Math.round((PROMO_DURATION_MS / 1000) * fps);
    const start = performance.now();
    for (let i = 0; i <= frames; i++) {
      const ms = (i / fps) * 1000;
      draw(ms);
      setExporting({ pct: Math.round((i / frames) * 100) });
      // انتظر الإطار التالي فعلياً (captureStream يلتقط عند إعادة الرسم).
      const target = start + (i + 1) * (1000 / fps);
      const wait = Math.max(0, target - performance.now());
      await new Promise((r) => setTimeout(r, wait));
    }
    rec.stop();
    await done;
    stream.getTracks().forEach((tr) => tr.stop());
    const blob = new Blob(chunks, { type: mime });
    setExportUrl({ url: URL.createObjectURL(blob), ext: mime.startsWith("video/mp4") ? "mp4" : "webm" });
    setExporting(null);
    timeRef.current = 0;
    draw(0);
    if (!reduced && autoPlay) play();
  }, [draw, exporting, play, reduced, autoPlay, stop]);

  const exportPoster = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const wasPlaying = playingRef.current;
    stop();
    draw(PROMO_DURATION_MS - 1200);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `promo-iptv-${aspect}-poster.png`;
    a.click();
    draw(timeRef.current);
    if (wasPlaying) play();
  }, [aspect, draw, play, stop]);

  const cta = ctaRect(aspect);
  const showCta = scene === "cta";
  const featureText = full.features.map((f) => `${f.headline}: ${f.caption}`).join("، ");

  return (
    <figure className={cn("flex w-full flex-col gap-3", className)}>
      <span ref={probeRef} className="hidden" aria-hidden="true" />
      <div className={cn("relative w-full overflow-hidden rounded-card shadow-lg", aspect === "portrait" ? "aspect-[9/16]" : "aspect-video")}>
        {videoSrc && <video ref={videoRef} src={videoSrc} muted playsInline loop preload="metadata" className="hidden" aria-hidden="true" />}
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`${full.brand}. ${full.title}. ${full.tagline}. ${featureText}`}
          className="block h-full w-full"
          onClick={() => (playing ? stop() : play())}
        />
        {/* رابط حقيقي فوق زر الدعوة المرسوم على الكانفاس (وصولية + نقر). */}
        <Link
          href={ctaHref}
          aria-label={full.ctaLabel}
          tabIndex={showCta ? 0 : -1}
          className={cn(
            "absolute rounded-full transition-opacity duration-base ease-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--text-on-brand)]",
            showCta ? "opacity-100" : "pointer-events-none opacity-0",
          )}
          style={{ insetInlineStart: `${cta.x * 100}%`, top: `${cta.y * 100}%`, width: `${cta.w * 100}%`, height: `${cta.h * 100}%` }}
        >
          <span className="sr-only">{full.ctaLabel}</span>
        </Link>
        {/* شريط تقدّم الحلقة. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-[var(--text-on-brand)]/20" aria-hidden="true">
          <div ref={progressRef} className="h-full w-full origin-right bg-[var(--brand-accent)]" style={{ transform: "scaleX(0)" }} />
        </div>
        {exporting && (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-inverse)]/70" role="status" aria-live="polite">
            <span className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink shadow-md">جارٍ تصدير الفيديو… {exporting.pct}%</span>
          </div>
        )}
      </div>

      {controls && (
        <figcaption className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => (playing ? stop() : play())} aria-pressed={playing}>
            {playing ? "إيقاف مؤقت" : "تشغيل"}
          </Button>
          <Button size="sm" variant="outline" onClick={replay}>
            إعادة من البداية
          </Button>
          <Button size="sm" variant="outline" onClick={exportVideo} disabled={!!exporting}>
            تصدير فيديو ({aspect === "portrait" ? "9:16" : "16:9"})
          </Button>
          <Button size="sm" variant="ghost" onClick={exportPoster}>
            حفظ صورة الغلاف
          </Button>
          {exportUrl && (
            <a href={exportUrl.url} download={`promo-iptv-${aspect}.${exportUrl.ext}`} className="text-sm font-semibold text-[var(--text-link)] underline underline-offset-4">
              تنزيل الملف الناتج (.{exportUrl.ext})
            </a>
          )}
          {exportError && (
            <span className="text-sm text-[var(--error-bg)]" role="alert">
              {exportError}
            </span>
          )}
          <span className="ms-auto text-xs text-ink-secondary">
            {Math.round(PROMO_DURATION_MS / 1000)} ثانية · {aspect === "portrait" ? "جوال" : "سطح المكتب"}
            {reduced && " · وضع الحركة المخفّضة"}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
