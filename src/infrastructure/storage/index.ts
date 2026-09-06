/** تجريد التخزين. التنفيذ الحالي: أي خدمة متوافقة مع S3 (MinIO / R2). */
export interface StorageProvider {
  upload(path: string, body: Buffer | Uint8Array, contentType: string): Promise<{ url: string }>;
  remove(path: string): Promise<void>;
  publicUrl(path: string): string;
}

export { storage } from "./s3";
