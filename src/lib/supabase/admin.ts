import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * عميل بصلاحيات service_role. للاستخدام على الخادم فقط (Webhooks، مهام خلفية).
 * لا تستورده أبداً في كود يعمل على المتصفح.
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
