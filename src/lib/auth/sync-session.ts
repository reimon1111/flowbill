import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

/** signIn 直後など、DB 操作前に JWT をクライアントへ確実に載せる */
export async function syncBrowserSession(session: Session): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) throw error;
}

/** RLS 用に auth.uid() が取れるまで待つ */
export async function waitForAuthSession(
  maxAttempts = 8,
  delayMs = 150
): Promise<Session> {
  const supabase = getSupabaseBrowserClient();

  for (let i = 0; i < maxAttempts; i++) {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    if (session?.user) return session;
    await new Promise((r) => setTimeout(r, delayMs));
  }

  throw new Error(
    "認証セッションが確立されていません。ページを再読み込みして再度ログインしてください。"
  );
}
