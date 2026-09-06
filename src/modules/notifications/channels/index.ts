import { emailChannel } from "./email";
import { whatsappChannel } from "./whatsapp";
import { smsChannel } from "./sms";
import type { ChannelProvider } from "./types";

export const channels: Record<"email" | "whatsapp" | "sms", ChannelProvider> = {
  email: emailChannel,
  whatsapp: whatsappChannel,
  sms: smsChannel,
};

export type { ChannelProvider, OutgoingMessage } from "./types";
