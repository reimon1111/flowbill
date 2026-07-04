import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { syncBrowserSession, waitForAuthSession } from "@/lib/auth/sync-session";
import { formatSupabaseError, logSupabaseError } from "@/lib/db/errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { setCachedCompanyId } from "@/lib/db/company-context";
import { consumePendingInviteToken } from "@/lib/auth/pending-invite-token";

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

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code: string }).code) : "";
  const message =
    "message" in error ? String((error as { message: string }).message) : "";
  return (
    code === "23505" ||
    message.includes("profiles_user_id_unique") ||
    message.includes("company_members_company_user_unique")
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

async function resolveExistingCompanyId(userId: string): Promise<string | null> {
  const profile = await fetchProfileForUser(userId);
  if (profile?.companyId) {
    setCachedCompanyId(profile.companyId);
    return profile.companyId;
  }
  return null;
}

async function ensureViaRpc(email: string, userId: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const inviteToken = consumePendingInviteToken();
  const { data, error } = await supabase.rpc("ensure_user_profile", {
    p_email: email,
    p_invite_token: inviteToken,
  });

  if (error) {
    if (isRpcUnavailable(error)) {
      throw new Error(
        "ensure_user_profile RPC が利用できません。supabase/add-signup-access-control.sql を適用してください。"
      );
    }
    if (isUniqueViolation(error)) {
      const existing = await resolveExistingCompanyId(userId);
      if (existing) return existing;
    }
    logSupabaseError("ensure_user_profile rpc error", error);
    throw error;
  }

  if (typeof data !== "string" || !data) {
    const existing = await resolveExistingCompanyId(userId);
    if (existing) return existing;
    throw new Error("会社IDの取得に失敗しました");
  }

  return data;
}

/** 初回ログイン時に company + profile を作成（Supabase 設定時は RPC のみ） */
export async function ensureUserProfileAndCompany(
  user: User,
  session?: Session | null
): Promise<string> {
  if (!isSupabaseConfigured()) {
    const envId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID;
    if (envId) {
      setCachedCompanyId(envId);
      return envId;
    }
    throw new Error("Supabase is not configured and no default company id");
  }

  if (session) {
    await syncBrowserSession(session);
  }
  await waitForAuthSession();

  const email = user.email ?? "";

  const existingBeforeRpc = await resolveExistingCompanyId(user.id);
  if (existingBeforeRpc) {
    return existingBeforeRpc;
  }

  const companyId = await ensureViaRpc(email, user.id);
  setCachedCompanyId(companyId);
  return companyId;
}

export function profileSetupHint(error: unknown): string {
  const msg = formatSupabaseError(error);
  if (msg.includes("テーブル") || msg.includes("PGRST205")) {
    return "Supabase SQL Editor で supabase/schema.sql を実行してください。";
  }
  if (msg.includes("signup_not_allowed")) {
    return "このメールアドレスは登録許可されていません。ご契約後に登録可能になります。";
  }
  if (
    msg.includes("ensure_user_profile") ||
    msg.includes("PGRST202") ||
    msg.includes("RPC が利用できません")
  ) {
    return "supabase/add-signup-access-control.sql と fix-security-high-risks.sql を SQL Editor で実行してください。";
  }
  if (msg.includes("RLS") || msg.includes("42501")) {
    return "schema-auth.sql の RLS ポリシーが適用されているか確認してください。";
  }
  return "Supabase の profiles テーブルと RLS 設定を確認してください。";
}
