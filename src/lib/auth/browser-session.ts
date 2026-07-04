import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isStaleAuthSessionError } from "@/lib/auth/errors";
import { clearStaleBrowserSession } from "@/lib/auth/session";

/** ブラウザの保存済みセッションを読み込む。無効な refresh token は破棄して null を返す */
export async function readBrowserSession(): Promise<Session | null> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    if (isStaleAuthSessionError(error)) {
      await clearStaleBrowserSession();
      return null;
    }
    throw error;
  }

  return session;
}
