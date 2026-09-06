import type { ChannelProvider, OutgoingMessage } from "./types";

/**
 * قناة واتساب. طريقتان:
 * 1) WhatsApp Cloud API (ميتا): WHATSAPP_PHONE_ID + WHATSAPP_TOKEN.
 * 2) مزود SaaS خارجي: WHATSAPP_SAAS_URL + WHATSAPP_SAAS_TOKEN (POST بسيط).
 * الإعدادات لكل متجر تُضاف لاحقاً؛ الآن على مستوى البيئة كنقطة انطلاق.
 */
export const whatsappChannel: ChannelProvider = {
  channel: "whatsapp",
  isConfigured: () =>
    Boolean((process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) || (process.env.WHATSAPP_SAAS_URL && process.env.WHATSAPP_SAAS_TOKEN)),
  async send(msg: OutgoingMessage) {
    if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) {
      const res = await fetch(`https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: msg.recipient, type: "text", text: { body: msg.body } }),
      });
      if (!res.ok) throw new Error(`whatsapp-meta ${res.status}: ${await res.text()}`);
      return;
    }
    if (process.env.WHATSAPP_SAAS_URL && process.env.WHATSAPP_SAAS_TOKEN) {
      const res = await fetch(process.env.WHATSAPP_SAAS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.WHATSAPP_SAAS_TOKEN}`, "content-type": "application/json" },
        body: JSON.stringify({ to: msg.recipient, message: msg.body }),
      });
      if (!res.ok) throw new Error(`whatsapp-saas ${res.status}: ${await res.text()}`);
      return;
    }
    console.log(`[whatsapp:dev] → ${msg.recipient}\n${msg.body}`);
  },
};
