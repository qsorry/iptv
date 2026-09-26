import { requestJson } from "./http";

/**
 * واجهة خادم المنصة (/api/v1/player): التعرّف على المزوّد، أكواد التفعيل، وربط التلفاز.
 * لا يمر عبرها أي محتوى؛ التطبيق يتصل بخادم المزوّد مباشرة.
 */
export const API_BASE = (import.meta.env?.VITE_API_BASE || "https://com.ssouq.net").replace(/\/$/, "");

export interface ServerAccount {
  provider: { name: string };
  server: { label: string; url: string };
  username: string;
  password: string;
}

export interface Detected {
  provider: { name: string };
  server: { label: string; url: string };
}

export async function detectProvider(username: string): Promise<Detected | null> {
  const res = await requestJson<{ data: Detected | null }>(`${API_BASE}/api/v1/player/detect?username=${encodeURIComponent(username)}`, { timeoutMs: 10000 });
  return res.data;
}

/** تحقق بلا أثر (لا يُحسب استخداماً): اسم المزوّد والخادم فقط. */
export async function checkCode(code: string): Promise<Pick<ServerAccount, "provider"> & { server: { label: string } }> {
  const res = await requestJson<{ data: Pick<ServerAccount, "provider"> & { server: { label: string } } }>(`${API_BASE}/api/v1/player/activate`, {
    method: "POST",
    body: { code, dryRun: true },
    timeoutMs: 15000,
  });
  return res.data;
}

export async function activateCode(code: string): Promise<ServerAccount> {
  const res = await requestJson<{ data: ServerAccount }>(`${API_BASE}/api/v1/player/activate`, { method: "POST", body: { code }, timeoutMs: 15000 });
  return res.data;
}

export interface Pairing {
  id: string;
  code: string;
  pollToken: string;
  expiresAt: string;
  pairUrl: string;
}

export async function startPairing(): Promise<Pairing> {
  const res = await requestJson<{ data: Pairing }>(`${API_BASE}/api/v1/player/pairings`, { method: "POST", timeoutMs: 15000 });
  return res.data;
}

export type PairingPoll = { status: "pending" | "consumed" | "expired" } | { status: "completed"; account: ServerAccount };

export async function pollPairing(p: Pick<Pairing, "id" | "pollToken">): Promise<PairingPoll> {
  const res = await requestJson<{ data: PairingPoll }>(`${API_BASE}/api/v1/player/pairings/${encodeURIComponent(p.id)}`, {
    headers: { Authorization: `Bearer ${p.pollToken}` },
    timeoutMs: 10000,
  });
  return res.data;
}

/**
 * تنسيق أثناء الكتابة بنفس صيغة الخادم: «8h3k92pl» → «SN-8H3K-92PL».
 * «S» و«SN» تبقيان كما هما حتى يعمل الحذف للخلف دون أن تعود الشرطة.
 */
export function formatActivationInput(input: string): string {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw === "S" || raw === "SN") return raw;
  const c = (raw.startsWith("SN") ? raw.slice(2) : raw).slice(0, 8);
  if (!c) return "";
  return c.length > 4 ? `SN-${c.slice(0, 4)}-${c.slice(4)}` : `SN-${c}`;
}

export const ACTIVATION_PATTERN = /^SN-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
