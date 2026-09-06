import type { ChannelProvider, OutgoingMessage } from "./types";

/**
 * قناة الإيميل. تستخدم Resend عبر HTTP إن توفّر RESEND_API_KEY، وإلا تسجّل الرسالة (تطوير).
 * لا نعتمد على مكتبة خارجية حتى يبقى الاعتماد خفيفاً.
 */
export const emailChannel: ChannelProvider = {
  channel: "email",
  isConfigured: () => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  async send(msg: OutgoingMessage) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) {
      console.log(`[email:dev] → ${msg.recipient} | ${msg.subject}\n${msg.body}`);
      return;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: msg.recipient, subject: msg.subject ?? "", html: msg.body }),
    });
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  },
};
