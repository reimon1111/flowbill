import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** @deprecated 名称互換 — ブラウザクライアント（Auth 付き）を返す */
export function getSupabaseClient(): SupabaseClient {
  return getSupabaseBrowserClient();
}
