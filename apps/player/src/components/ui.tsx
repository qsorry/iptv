import { useState, type ReactNode } from "react";
import { initial, logoText } from "../lib/format";
import { Icon } from "./Icon";

/** خلفية ثابتة لكل عنصر بلا صورة (من معرّفه). */
export function toneFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return `var(--tone-${Math.abs(h) % 10})`;
}

/** صورة تملأ الإطار، وإن غابت أو فشلت: لون ثابت وحرف أول. */
export function Media({ src, seed, name, showInitial = true }: { src?: string; seed: string; name: string; showInitial?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <span className="media-fill" style={{ background: toneFor(seed) }} />
      {showInitial && (!src || failed) && <span className="media-initial">{initial(name)}</span>}
      {src && !failed && <img className="media-fill" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />}
    </>
  );
}

export function Progress({ value, className = "" }: { value: number; className?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`progress ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ChannelLogo({ src, name, small }: { src?: string; name: string; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <span className={`logo-box${small ? " logo-box-sm" : ""}`}>{src && !failed ? <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /> : logoText(name)}</span>;
}

export interface PosterProps {
  id: string;
  title: string;
  image?: string;
  href: string;
  meta?: string;
  /** شارة الزاوية اليسرى (عدد الحلقات، التقييم). */
  badge?: string;
  isNew?: boolean;
  progress?: number;
  /** العنوان داخل الملصق (المكتبة) أو تحته (الجوال). */
  caption?: "inside" | "below";
  autoFocus?: boolean;
}

export function Poster({ id, title, image, href, meta, badge, isNew, progress, caption = "inside", autoFocus }: PosterProps) {
  return (
    <a className="tile" href={href} data-autofocus={autoFocus || undefined} aria-label={title}>
      <div className="poster">
        <Media src={image} seed={id} name={title} />
        {isNew && <span className="badge badge-accent corner-tr">جديد</span>}
        {badge && <span className={`badge ${caption === "inside" ? "corner-tl" : "corner-bl"} ltr`}>{badge}</span>}
        {caption === "inside" && (
          <div className="poster-caption">
            <div className="title truncate">{title}</div>
            {meta && <div className="meta truncate">{meta}</div>}
          </div>
        )}
        {progress !== undefined && progress > 0 && <Progress value={progress} className="progress-bottom" />}
      </div>
      {caption === "below" && (
        <>
          <div className="tile-title truncate">{title}</div>
          {meta && <div className="tile-meta truncate">{meta}</div>}
        </>
      )}
    </a>
  );
}

/** بطاقة عريضة (تابع المشاهدة، الحلقات). */
export function WideCard({ id, title, meta, image, href, progress, badge, width, state }: { id: string; title: string; meta?: string; image?: string; href: string; progress?: number; badge?: string; width: string; state?: string }) {
  return (
    <a className="tile" href={href} style={{ width }} aria-label={title}>
      <div className="thumb">
        <Media src={image} seed={id} name={title} showInitial={false} />
        <span className="media-play">
          <Icon name="play" size={28} />
        </span>
        {badge && <span className="badge corner-tr">{badge}</span>}
        {progress !== undefined && <Progress value={progress} className="progress-bottom" />}
      </div>
      <div className="row row-2 row-baseline" style={{ marginTop: "0.5rem" }}>
        <div className="grow truncate" style={{ fontSize: "0.875rem", fontWeight: 600 }}>{title}</div>
        {meta && <div className="tile-meta">{meta}</div>}
      </div>
      {state && <div className="tile-meta">{state}</div>}
    </a>
  );
}

export function SectionHead({ title, link, aside }: { title: string; link?: { href: string; label: string }; aside?: ReactNode }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      {aside}
      {link && <a href={link.href}>{link.label}</a>}
    </div>
  );
}

export function Loading({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="state" role="status">
      <div className="spinner" />
      <div>{label}</div>
    </div>
  );
}

export function ErrorState({ error, onRetry, title = "تعذّر التحميل" }: { error: Error | string; onRetry?: () => void; title?: string }) {
  return (
    <div className="state" role="alert">
      <Icon name="alert" size={36} />
      <h2>{title}</h2>
      <p>{typeof error === "string" ? error : error.message}</p>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry} data-autofocus>
          <Icon name="refresh" size={18} />
          <span>إعادة المحاولة</span>
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
