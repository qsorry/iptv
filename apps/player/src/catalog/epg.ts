import type { EpgEntry } from "./types";

export interface NowNext {
  current?: EpgEntry;
  next?: EpgEntry;
  /** تقدّم البرنامج الحالي بين 0 و1. */
  progress: number;
}

export function nowNext(entries: EpgEntry[], now = Date.now()): NowNext {
  const idx = entries.findIndex((e) => e.start <= now && now < e.end);
  const current = idx >= 0 ? entries[idx] : undefined;
  const next = idx >= 0 ? entries[idx + 1] : entries.find((e) => e.start > now);
  const progress = current ? Math.min(1, Math.max(0, (now - current.start) / (current.end - current.start))) : 0;
  return { current, next, progress };
}

/** شريحة من الدليل بين from وto: كل برنامج بعرض نسبي (span) لرسم الشبكة. */
export function epgSlice(entries: EpgEntry[], from: number, to: number, now = Date.now()) {
  const total = to - from;
  return entries
    .filter((e) => e.end > from && e.start < to)
    .map((e) => {
      const s = Math.max(e.start, from);
      const t = Math.min(e.end, to);
      return { entry: e, span: (t - s) / total, live: e.start <= now && now < e.end };
    });
}
