/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** أصل خادم المنصة الذي يستضيف /api/v1/player (الافتراضي https://com.ssouq.net). */
  readonly VITE_API_BASE?: string;
}
