import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface DownloadFile {
  file: string;
  label: string;
  bytes: number;
  sha256: string;
}

export interface AppDownloads {
  version: string;
  publishedAt: string;
  files: Partial<Record<"android" | "webos", DownloadFile>>;
}

/** بيان الحزم المنشورة في public/downloads/player (يكتبه apps/player/scripts/publish-downloads.mjs). */
export async function readAppDownloads(): Promise<AppDownloads | null> {
  try {
    const raw = await readFile(join(process.cwd(), "public", "downloads", "player", "manifest.json"), "utf8");
    const data = JSON.parse(raw) as AppDownloads;
    return data && typeof data.version === "string" && data.files ? data : null;
  } catch {
    return null;
  }
}

export const DOWNLOADS_PATH = "/downloads/player";
