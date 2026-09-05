/** تجريد التخزين. التنفيذ الحالي: Supabase Storage. */
export interface StorageProvider {
  upload(bucket: string, path: string, file: File | Blob): Promise<{ url: string }>;
  remove(bucket: string, path: string): Promise<void>;
}
