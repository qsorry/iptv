import { readJson, writeJson } from "./storage";

export interface Settings {
  /** صيغة البث المباشر في Xtream: HLS أنسب للمتصفحات، وTS أخف على بعض التلفزيونات. */
  liveFormat: "m3u8" | "ts";
  /** واجهة التلفاز: تلقائي حسب الجهاز، أو فرضها (للتجربة من المتصفح). */
  tvMode: "auto" | "on" | "off";
  /** تشغيل الحلقة التالية تلقائياً. */
  autoplayNext: boolean;
}

const DEFAULTS: Settings = { liveFormat: "m3u8", tvMode: "auto", autoplayNext: true };
const KEY = "settings";
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return { ...DEFAULTS, ...readJson<Partial<Settings>>(KEY, {}) };
}

export function updateSettings(patch: Partial<Settings>) {
  writeJson(KEY, { ...getSettings(), ...patch });
  listeners.forEach((fn) => fn());
}

export function subscribeSettings(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
