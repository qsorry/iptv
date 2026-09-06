export interface OutgoingMessage {
  recipient: string;
  subject?: string;
  body: string;
}

export interface ChannelProvider {
  readonly channel: "email" | "whatsapp" | "sms";
  /** يرسل الرسالة. يرمي عند الفشل. */
  send(msg: OutgoingMessage): Promise<void>;
  /** هل المزود مُهيّأ بإعدادات كافية للإرسال فعلاً. */
  isConfigured(): boolean;
}
