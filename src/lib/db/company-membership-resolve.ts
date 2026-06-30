import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { CompanyMemberRole } from "@/lib/types/company-membership";

export type UserCompanyMembership = {
  companyId: string;
  role: CompanyMemberRole;
  joinedAt: string;
};

/**
 * 招待メンバーが個人用会社（owner）とチーム会社（member/admin）の両方に
 * 所属している場合、チーム側を優先する。
 */
export function pickPrimaryCompanyId(
  memberships: UserCompanyMembership[],
  profileCompanyId: string | null
): string | null {
  if (memberships.length === 0) return profileCompanyId;

  const teamMembership = memberships.find((m) => m.role !== "owner");
  if (teamMembership) return teamMembership.companyId;

  if (
    profileCompanyId &&
    memberships.some((m) => m.companyId === profileCompanyId)
  ) {
    return profileCompanyId;
  }

  return memberships[0]?.companyId ?? profileCompanyId;
}

export async function fetchUserCompanyMemberships(
  userId: string
): Promise<UserCompanyMembership[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, role, joined_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) {
    // マイグレーション未適用時は空配列（profiles.company_id のみ使用）
    if (error.code === "PGRST205" || error.code === "42P01") return [];
    throw error;
  }

  return (data ?? []).map((row) => ({
    companyId: row.company_id as string,
    role: row.role as CompanyMemberRole,
    joinedAt: row.joined_at as string,
  }));
}

/** profiles.company_id がチーム会社とずれている場合に同期 */
export async function syncProfileCompanyId(
  userId: string,
  companyId: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("profiles")
    .update({ company_id: companyId, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .neq("company_id", companyId);

  if (error) throw error;
}
