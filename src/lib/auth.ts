import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/infrastructure/database/client";
import * as schema from "@/infrastructure/database/schema";
import { env } from "@/lib/env";

/** إعداد المصادقة على الخادم. للاستخدام في Route Handlers و Server Components فقط. */
export const auth = betterAuth({
  baseURL: env.NEXT_PUBLIC_APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: { users: schema.users, sessions: schema.sessions, accounts: schema.accounts, verifications: schema.verifications },
  }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  user: {
    additionalFields: {
      phone: { type: "string", required: false, input: true },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 يوماً
    updateAge: 60 * 60 * 24,
  },
  advanced: {
    database: { generateId: "uuid" },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
