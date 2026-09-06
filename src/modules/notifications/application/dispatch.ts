import { db } from "@/infrastructure/database/client";
import { notifications } from "@/infrastructure/database/schema";
import { getStoreFeatures, FEATURES } from "@/modules/billing";
import { channels } from "../channels";

type Channel = "email" | "whatsapp" | "sms";

const featureFor: Record<Channel, string> = {
  email: FEATURES.notifyEmail,
  whatsapp: FEATURES.notifyWhatsapp,
  sms: FEATURES.notifySms,
};

export interface DispatchInput {
  storeId: string;
  channel: Channel;
  type: string;
  recipient: string;
  subject?: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * يرسل إشعاراً عبر قناة واحدة ويسجّل صفاً بالنتيجة.
 * - القناة المدفوعة بلا ميزة → skipped (لا إرسال).
 * - المزود غير مُهيّأ → skipped مع سبب.
 * - غير ذلك → يُرسل ويُسجَّل sent أو failed.
 */
export async function dispatch(input: DispatchInput) {
  const provider = channels[input.channel];
  const base = {
    storeId: input.storeId,
    channel: input.channel,
    type: input.type,
    recipient: input.recipient,
    subject: input.subject,
    body: input.body,
    data: input.data,
  };

  const features = await getStoreFeatures(input.storeId);
  if (!features.has(featureFor[input.channel])) {
    await db.insert(notifications).values({ ...base, status: "skipped", error: "الميزة غير مفعّلة لهذا المتجر" });
    return { status: "skipped" as const };
  }
  if (!provider.isConfigured() && process.env.NODE_ENV === "production") {
    await db.insert(notifications).values({ ...base, status: "skipped", error: "المزود غير مُهيّأ" });
    return { status: "skipped" as const };
  }

  try {
    await provider.send({ recipient: input.recipient, subject: input.subject, body: input.body });
    await db.insert(notifications).values({ ...base, status: "sent", sentAt: new Date() });
    return { status: "sent" as const };
  } catch (e) {
    await db.insert(notifications).values({ ...base, status: "failed", error: e instanceof Error ? e.message : String(e) });
    return { status: "failed" as const };
  }
}
