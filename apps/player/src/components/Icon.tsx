/** أيقونات خطية (من لوحة التصميم) بلون currentColor. */
const PATHS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z",
  live: "M3 7h18v12H3zM8 3l4 4 4-4",
  movies: "M4 4h16v16H4zM4 9h16M4 15h16M9 4v16M15 4v16",
  series: "M4 6h16M4 12h16M4 18h10",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.5-4.5",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1",
  back: "M5 12h14M13 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  check: "M20 6L9 17l-5-5",
  heart: "M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z",
  filter: "M4 6h16M7 12h10M10 18h4",
  alert: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8v4.5M12 16h.01",
  qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7M14 18h7",
  recent: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  resume: "M12 3a9 9 0 1 0 9 9M12 7v5l3 2M21 3v6h-6",
  guide: "M3 5h18v14H3zM3 10h18M9 10v9",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  exit: "M15 12H3M9 6l-6 6 6 6M14 4h6v16h-6",
  next: "M5 5l10 7-10 7zM19 5v14",
  prev: "M19 5L9 12l10 7zM5 5v14",
  rw: "M11 19l-9-7 9-7zM22 19l-9-7 9-7z",
  ff: "M13 19l9-7-9-7zM2 19l9-7-9-7z",
  audio: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12",
  subtitles: "M3 5h18v14H3zM7 13h4M13 13h4M7 16h10",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  refresh: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
  expand: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  link: "M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
} as const;

export type IconName = keyof typeof PATHS | "play" | "pause";

export function Icon({ name, size = 22, strokeWidth = 2, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  const style = { width: `${size / 16}rem`, height: `${size / 16}rem` };
  if (name === "play") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} style={style}>
        <path d="M7 4l13 8-13 8z" />
      </svg>
    );
  }
  if (name === "pause") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} style={style}>
        <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** شعار التطبيق: مثلث التشغيل في مربع اللون المميز. */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: `${size / 16}rem`, height: `${size / 16}rem`, borderRadius: `${(size * 0.28) / 16}rem` }}>
      <Icon name="play" size={size * 0.46} />
    </span>
  );
}
