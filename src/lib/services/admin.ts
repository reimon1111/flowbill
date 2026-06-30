import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logSupabaseError } from "@/lib/db/errors";
import type {
  AdminCompanyRow,
  AllowedSignupRecord,
  ContractStatus,
} from "@/lib/types/signup-access";
import { buildSignupUrl } from "@/lib/services/signup-access";

function toIso(v: string | null | undefined): string {
  if (!v) return "";
  return v.includes("T") ? v : `${v}T00:00:00.000Z`;
}

function allowedFromRow(row: Record<string, unknown>): AllowedSignupRecord {
  return {
    id: row.id as string,
    email: row.email as string,
    companyName: (row.company_name as string) ?? "",
    role: (row.role as string) ?? "owner",
    status: row.status as AllowedSignupRecord["status"],
    token: row.token as string,
    usedAt: row.used_at ? toIso(row.used_at as string) : null,
    expiresAt: row.expires_at ? toIso(row.expires_at as string) : null,
    invitedBy: (row.invited_by as string | null) ?? null,
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  };
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("is_admin_user");
  if (error) {
    console.error("isCurrentUserAdmin", error);
    return false;
  }
  return Boolean(data);
}

export async function adminListAllowedSignups(): Promise<AllowedSignupRecord[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_allowed_signups");
  if (error) {
    console.error("adminListAllowedSignups", error);
    logSupabaseError("admin_list_allowed_signups", error);
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => allowedFromRow(row));
}

export async function adminCreateAllowedSignup(input: {
  email: string;
  companyName: string;
  role?: string;
  expiresAt?: string | null;
}): Promise<{ record: AllowedSignupRecord; signupUrl: string }> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("admin_create_allowed_signup", {
    p_email: input.email.trim().toLowerCase(),
    p_company_name: input.companyName.trim(),
    p_role: input.role ?? "owner",
    p_expires_at: input.expiresAt ?? null,
  });
  if (error) {
    console.error("adminCreateAllowedSignup", { input, error });
    logSupabaseError("admin_create_allowed_signup", error);
    throw error;
  }
  const record = allowedFromRow(data as Record<string, unknown>);
  return {
    record,
    signupUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}${buildSignupUrl({ allowedToken: record.token })}`
        : buildSignupUrl({ allowedToken: record.token }),
  };
}

export async function adminCancelAllowedSignup(id: string): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("admin_cancel_allowed_signup", {
    p_id: id,
  });
  if (error) {
    console.error("adminCancelAllowedSignup", { id, error });
    logSupabaseError("admin_cancel_allowed_signup", error);
    throw error;
  }
}

export async function adminListCompanies(): Promise<AdminCompanyRow[]> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("admin_list_companies");
  if (error) {
    console.error("adminListCompanies", error);
    logSupabaseError("admin_list_companies", error);
    throw error;
  }
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    companyName: row.company_name as string,
    email: (row.email as string) ?? "",
    contractStatus: row.contract_status as ContractStatus,
    contractStartedAt: row.contract_started_at
      ? toIso(row.contract_started_at as string)
      : null,
    contractEndedAt: row.contract_ended_at
      ? toIso(row.contract_ended_at as string)
      : null,
    createdAt: toIso(row.created_at as string),
    memberCount: Number(row.member_count ?? 0),
  }));
}

export async function adminUpdateContractStatus(
  companyId: string,
  status: ContractStatus
): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.rpc("admin_update_contract_status", {
    p_company_id: companyId,
    p_status: status,
  });
  if (error) {
    console.error("adminUpdateContractStatus", { companyId, status, error });
    logSupabaseError("admin_update_contract_status", error);
    throw error;
  }
}
