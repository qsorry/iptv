import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import type { StorageProvider } from "./index";

let client: S3Client | null = null;

function getClient() {
  if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("إعدادات S3 غير مكتملة (S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)");
  }
  client ??= new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: true, // MinIO
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return client;
}

export const storage: StorageProvider = {
  async upload(path, body, contentType) {
    await getClient().send(new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: path, Body: body, ContentType: contentType }));
    return { url: this.publicUrl(path) };
  },
  async remove(path) {
    await getClient().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: path }));
  },
  publicUrl(path) {
    const base = env.S3_PUBLIC_URL ?? `${env.S3_ENDPOINT}/${env.S3_BUCKET}`;
    return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  },
};
