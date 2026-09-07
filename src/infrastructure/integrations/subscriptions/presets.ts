import type { ProviderConfig } from "./types";

export type PresetId = "shebik" | "falcon" | "generic";

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  baseUrl: string;
  config: ProviderConfig;
}

const DELIVERY = "HOST:{{host}}|UserName:{{username}}|Password:{{password}}|Expires:{{expiresAt}}|M3U:{{m3u}}";

/**
 * قوالب جاهزة. المسارات وأسماء الحقول قابلة للتعديل من لوحة التحكم (JSON)
 * لأن كل لوحة IPTV تختلف قليلاً؛ عدّلها بحسب وثائق مزوّدك إن اختلفت.
 */
export const PRESETS: Record<PresetId, Preset> = {
  shebik: {
    id: "shebik",
    name: "Shebik IPTV",
    description: "لوحة shebik.com (واجهة api/ على المنفذ 2082). المفتاح يُمرَّر كمعامل api_key.",
    baseUrl: "http://shebik.com:2082/iptv/api/",
    config: {
      auth: { type: "query", name: "api_key" },
      test: { method: "GET", path: "", query: { action: "user_info" } },
      packages: { method: "GET", path: "", query: { action: "packages" }, listPath: "data", idField: "id", nameField: "name" },
      create: {
        method: "POST",
        path: "",
        contentType: "form",
        body: {
          action: "new_line",
          package_id: "{{packageId}}",
          months: "{{params.months}}",
          max_connections: "{{params.connections}}",
          note: "Order {{order.number}} #{{sequence}}",
          reference: "{{reference}}",
        },
      },
      result: {
        okPath: "success",
        errorPath: "message",
        username: "data.username",
        password: "data.password",
        host: "data.host",
        expiresAt: "data.exp_date",
        m3u: "data.m3u",
      },
      deliveryTemplate: DELIVERY,
    },
  },
  falcon: {
    id: "falcon",
    name: "Falcon Panel",
    description: "لوحة dash.falcon-panel.com (api/v1). المفتاح يُرسل كـ Bearer token.",
    baseUrl: "https://dash.falcon-panel.com/api/v1",
    config: {
      auth: { type: "bearer" },
      test: { method: "GET", path: "me" },
      packages: { method: "GET", path: "packages", listPath: "data", idField: "id", nameField: "name" },
      create: {
        method: "POST",
        path: "lines",
        body: {
          package_id: "{{packageId}}",
          months: "{{params.months}}",
          max_connections: "{{params.connections}}",
          note: "Order {{order.number}} #{{sequence}}",
          reference: "{{reference}}",
        },
      },
      result: {
        okPath: "ok",
        errorPath: "error",
        username: "data.username",
        password: "data.password",
        host: "data.host",
        expiresAt: "data.exp_date",
        m3u: "data.m3u",
      },
      deliveryTemplate: DELIVERY,
    },
  },
  generic: {
    id: "generic",
    name: "API مخصص",
    description: "أي مزوّد اشتراكات آخر. حدّد المصادقة ومسار الإنشاء وخريطة النتيجة يدوياً.",
    baseUrl: "https://example.com/api",
    config: {
      auth: { type: "bearer" },
      test: { method: "GET", path: "ping" },
      create: {
        method: "POST",
        path: "subscriptions",
        body: { package_id: "{{packageId}}", email: "{{customer.email}}", reference: "{{reference}}" },
      },
      result: { username: "username", password: "password", host: "host", expiresAt: "expires_at" },
      deliveryTemplate: DELIVERY,
    },
  },
};

/** معاملات الربط المقترحة لكل قالب (تظهر كحقول في نموذج الربط). */
export const MAPPING_PARAM_HINTS: Record<PresetId, { key: string; label: string; placeholder: string }[]> = {
  shebik: [
    { key: "months", label: "المدة (أشهر)", placeholder: "12" },
    { key: "connections", label: "عدد الاتصالات", placeholder: "1" },
  ],
  falcon: [
    { key: "months", label: "المدة (أشهر)", placeholder: "12" },
    { key: "connections", label: "عدد الاتصالات", placeholder: "1" },
  ],
  generic: [{ key: "months", label: "المدة (أشهر)", placeholder: "12" }],
};
