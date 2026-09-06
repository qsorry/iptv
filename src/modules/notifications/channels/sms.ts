import type { ChannelProvider, OutgoingMessage } from "./types";

/** قناة الرسائل النصية عبر مزود عام (SMS_URL + SMS_TOKEN). */
export const smsChannel: ChannelProvider = {
  channel: "sms",
  isConfigured: () => Boolean(process.env.SMS_URL && process.env.SMS_TOKEN),
  async send(msg: OutgoingMessage) {
    if (!process.env.SMS_URL || !process.env.SMS_TOKEN) {
      console.log(`[sms:dev] → ${msg.recipient}\n${msg.body}`);
      return;
    }
    const res = await fetch(process.env.SMS_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.SMS_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ to: msg.recipient, message: msg.body }),
    });
    if (!res.ok) throw new Error(`sms ${res.status}: ${await res.text()}`);
  },
};
