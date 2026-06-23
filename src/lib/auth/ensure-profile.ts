import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { syncBrowserSession, waitForAuthSession } from "@/lib/auth/sync-session";
import { generateId } from "@/lib/db/ids";
import { companyToRow } from "@/lib/db/mappers";
import { formatSupabaseError, logSupabaseError } from "@/lib/db/errors";
import { initialCompanySettings } from "@/lib/mock-company-settings";
import { setCachedCompanyId } from "@/lib/db/company-context";

export type UserProfile = {
  id: string;
  userId: string;
  companyId: string;
  email: string;
};

function isRpcUnavailable(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST202" ||
    (error.message?.includes("Could not find the function") ?? false) ||
    (error.message?.includes("ensure_user_profile") ?? false)
  );
}

export async function fetchProfileForUser(userId: string): Promise<UserProfile | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, company_id, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    logSupabaseError("fetchProfileForUser error", error);
    throw error;
  }
  if (!data) return null;

  return {
    id: data.id as string,
    userId: data.user_id as string,
    companyId: data.company_id as string,
    email: data.email as string,
  };
}

async function ensureViaRpc(email: string): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("ensure_user_profile", {
    p_email: email,
  });

  if (error) {
    if (isRpcUnavailable(error)) {
      console.warn("ensure_user_profile RPC not available, using client fallback");
      return null;
    }
    logSupabaseError("ensure_user_profile rpc error", error);
    throw error;
  }

  if (typeof data !== "string" || !data) {
    throw new Error("会社IDの取得に失敗しました");
  }

  return data;
}

/** クライアントから company + profile を作成（RLS ポリシー前提） */
async function ensureViaClientInserts(user: User): Promise<string> {
  const existing = await fetchProfileForUser(user.id);
  if (existing) {
    setCachedCompanyId(existing.companyId);
    return existing.companyId;
  }

  const supabase = getSupabaseBrowserClient();
  const now = new Date().toISOString();
  const companyId = generateId("co_");
  const email = user.email ?? "";

  const settings = {
    ...initialCompanySettings,
    id: companyId,
    companyName: email ? `${email.split("@")[0]}の会社` : "マイ会社",
    email,
    createdAt: now,
    updatedAt: now,
  };

  const { error: companyError } = await supabase
    .from("companies")
    .insert(companyToRow(settings));
  if (companyError) {
    logSupabaseError("ensureProfile company insert error", companyError);
    throw companyError;
  }

  const profileId = generateId("prof_");
  const { error: profileError } = await supabase.from("profiles").insert({
    id: profileId,
    user_id: user.id,
    company_id: companyId,
    email,
    created_at: now,
    updated_at: now,
  });
  if (profileError) {
    logSupabaseError("ensureProfile profile insert error", profileError);
    throw profileError;
  }

  setCachedCompanyId(companyId);
  return companyId;
}

/** 初回ログイン時に company + profile を作成 */
export async function ensureUserProfileAndCompany(
  user: User,
  session?: Session | null
): Promise<string> {
  if (session) {
    await syncBrowserSession(session);
  }
  await waitForAuthSession();

  const email = user.email ?? "";

  const rpcCompanyId = await ensureViaRpc(email);
  if (rpcCompanyId) {
    setCachedCompanyId(rpcCompanyId);
    return rpcCompanyId;
  }

  return ensureViaClientInserts(user);
}

export function profileSetupHint(error: unknown): string {
  const msg = formatSupabaseError(error);
  if (msg.includes("テーブル") || msg.includes("PGRST205")) {
    return "Supabase SQL Editor で supabase/schema.sql を実行してください。";
  }
  if (msg.includes("ensure_user_profile") || msg.includes("PGRST202")) {
    return "supabase/ensure-user-profile-rpc.sql も SQL Editor で実行してください。";
  }
  if (msg.includes("RLS") || msg.includes("42501")) {
    return "schema-auth.sql の RLS ポリシーが適用されているか確認してください。";
  }
  return "Supabase の profiles テーブルと RLS 設定を確認してください。";
}
