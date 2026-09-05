import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** عميل Supabase للاستخدام داخل مكونات المتصفح (Client Components). */
export function createClient() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
