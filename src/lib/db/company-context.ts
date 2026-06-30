import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  ensureUserProfileAndCompany,
  fetchProfileForUser,
} from "@/lib/auth/ensure-profile";
import { companyFromRow, type CompanyRow } from "@/lib/db/mappers";
import {
  fetchUserCompanyMemberships,
  pickPrimaryCompanyId,
  syncProfileCompanyId,
} from "@/lib/db/company-membership-resolve";

let cachedCompanyId: string | null = null;

export function getCachedCompanyId(): string | null {
  return cachedCompanyId;
}

export function setCachedCompanyId(id: string) {
  cachedCompanyId = id;
}

export function clearCompanyContext() {
  cachedCompanyId = null;
}

/**
 * ログイン中ユーザーの company_id を解決する。
 * チーム所属（member/admin/viewer）を個人用会社（owner）より優先する。
 *
 * bootstrap で古い company_id がキャッシュされていても、毎回メンバーシップを再評価する。
 */
export async function resolveCompanyId(): Promise<string> {
  if (!isSupabaseConfigured()) {
    const envId = process.env.NEXT_PUBLIC_DEFAULT_COMPANY_ID;
    if (envId) {
      cachedCompanyId = envId;
      return envId;
    }
    throw new Error("Supabase is not configured and no default company id");
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) throw authError;
  if (!user) throw new Error("ログインが必要です");

  const profile = await fetchProfileForUser(user.id);
  const memberships = await fetchUserCompanyMemberships(user.id);
  const resolved = pickPrimaryCompanyId(
    memberships,
    profile?.companyId ?? null
  );

  if (resolved) {
    if (profile && profile.companyId !== resolved) {
      try {
        await syncProfileCompanyId(user.id, resolved);
      } catch (syncError) {
        console.warn("syncProfileCompanyId", syncError);
      }
    }
    cachedCompanyId = resolved;
    return resolved;
  }

  if (profile?.companyId) {
    cachedCompanyId = profile.companyId;
    return profile.companyId;
  }

  const companyId = await ensureUserProfileAndCompany(user);
  cachedCompanyId = companyId;
  return companyId;
}

export async function fetchCompanySettings() {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();
  if (error) throw error;
  return companyFromRow(data as CompanyRow);
}
