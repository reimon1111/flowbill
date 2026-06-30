import type {
  CompanyInvitationRecord,
  CompanyInvitationRole,
  CompanyMemberRecord,
  CompanyMemberRole,
  PublicCompanyInvitationRecord,
} from "@/lib/types/company-membership";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import { logSupabaseError } from "@/lib/db/errors";
import { logAuthError } from "@/lib/auth/errors";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { dbInsertHistory } from "@/lib/db/write-projects";
import { recordActivityLog } from "@/lib/db/write-activity-log";
import {
  activityDescriptionInvitationCanceled,
  activityDescriptionMemberInvited,
  activityDescriptionMemberRemoved,
} from "@/lib/activity-log-messages";
import { useProjectStore } from "@/stores/project-store";

function toIso(v: string | null | undefined): string {
  if (!v) return new Date().toISOString();
  return v.includes("T") ? v : `${v}T00:00:00.000Z`;
}

// 会社切り替え機能は廃止（profiles.company_id を唯一の現在会社として使用）

export async function fetchCompanyMembers(
  companyId?: string
): Promise<CompanyMemberRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const targetCompanyId = companyId ?? (await resolveCompanyId());
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc("list_company_members", {
    p_company_id: targetCompanyId,
  });
  if (error) {
    console.error("fetchCompanyMembers", { companyId: targetCompanyId, error });
    logSupabaseError("list_company_members", error);
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    companyId: row.company_id as string,
    userId: row.user_id as string,
    role: row.role as CompanyMemberRole,
    status: row.status as CompanyMemberRecord["status"],
    email: (row.email as string) ?? "",
    joinedAt: toIso(row.joined_at as string),
    invitedBy: (row.invited_by as string | null) ?? null,
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  }));
}

export async function fetchPendingInvitations(
  companyId?: string
): Promise<CompanyInvitationRecord[]> {
  if (!isSupabaseConfigured()) return [];

  const targetCompanyId = companyId ?? (await resolveCompanyId());
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("company_invitations")
    .select("*")
    .eq("company_id", targetCompanyId)
    .is("accepted_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchPendingInvitations", { companyId: targetCompanyId, error });
    logSupabaseError("fetchPendingInvitations", error);
    throw error;
  }

  return (data ?? []).map(invitationFromRow);
}

function invitationFromRow(row: Record<string, unknown>): CompanyInvitationRecord {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    email: row.email as string,
    role: row.role as CompanyInvitationRole,
    token: row.token as string,
    invitedBy: row.invited_by as string,
    acceptedAt: row.accepted_at ? toIso(row.accepted_at as string) : null,
    expiresAt: toIso(row.expires_at as string),
    createdAt: toIso(row.created_at as string),
    updatedAt: toIso(row.updated_at as string),
  };
}

export async function fetchInvitationByToken(
  token: string
): Promise<CompanyInvitationRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("company_invitations")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    console.error("fetchInvitationByToken", { token, error });
    logSupabaseError("fetchInvitationByToken", error);
    throw error;
  }
  if (!data) return null;
  return invitationFromRow(data as Record<string, unknown>);
}

function publicInvitationFromRpcRow(
  row: Record<string, unknown>
): PublicCompanyInvitationRecord {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    companyName: (row.company_name as string) ?? "",
    email: (row.email as string) ?? "",
    role: row.role as CompanyInvitationRole,
    expiresAt: toIso(row.expires_at as string),
    acceptedAt: row.accepted_at ? toIso(row.accepted_at as string) : null,
  };
}

/**
 * 未ログインでも token で招待を1件取得（RLS回避の security definer RPC 経由）
 * - token が見つからない場合: null
 * - それ以外のエラー: throw
 */
export async function fetchPublicInvitationByToken(
  token: string
): Promise<PublicCompanyInvitationRecord | null> {
  if (!isSupabaseConfigured()) return null;

  const rpcName = "get_company_invitation_by_token";
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.rpc(rpcName, { p_token: token });

  const isDev = process.env.NODE_ENV !== "production";
  if (isDev) {
    console.debug("[fetchPublicInvitationByToken]", {
      inviteToken: token,
      rpcName,
      supabaseError: error ?? null,
      result: data ?? null,
    });
  }

  if (error) {
    console.error("[fetchPublicInvitationByToken] rpc error", {
      inviteToken: token,
      rpcName,
      supabaseError: error,
    });
    logSupabaseError(rpcName, error);
    throw error;
  }
  if (!data) return null;

  // PostgREST は setof/table を配列で返す
  const row = Array.isArray(data) ? (data[0] as Record<string, unknown> | undefined) : (data as Record<string, unknown>);
  if (!row) return null;
  return publicInvitationFromRpcRow(row);
}

export function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/invite/${token}`;
  return `${window.location.origin}/invite/${token}`;
}

export async function createCompanyInvitation(input: {
  email: string;
  role: CompanyInvitationRole;
}): Promise<{ invitation: CompanyInvitationRecord; inviteUrl: string }> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const token =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "")
      : generateId("inv_");

  const row = {
    id: generateId("cinv_"),
    company_id: companyId,
    email: input.email.trim().toLowerCase(),
    role: input.role,
    token,
    invited_by: user.id,
    expires_at: expiresAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (process.env.NODE_ENV === "development") {
    console.log("[createCompanyInvitation] insert", {
      companyId,
      userId: user.id,
      email: row.email,
      role: row.role,
    });
  }

  const { data, error } = await supabase
    .from("company_invitations")
    .insert(row)
    .select("*")
    .single();

  if (error) {
    console.error("createCompanyInvitation failed", {
      companyId,
      userId: user.id,
      error,
    });
    logSupabaseError("createCompanyInvitation", error);
    throw error;
  }

  const invitation = invitationFromRow(data as Record<string, unknown>);

  recordActivityLog({
    action: "invited",
    targetType: "invitation",
    targetId: invitation.id,
    targetLabel: invitation.email,
    description: activityDescriptionMemberInvited(invitation.email),
  });

  return { invitation, inviteUrl: buildInviteUrl(invitation.token) };
}

export async function cancelCompanyInvitation(invitationId: string): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseBrowserClient();
  const { data, error: fetchError } = await supabase
    .from("company_invitations")
    .select("email")
    .eq("id", invitationId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const email = String(data?.email ?? "");

  const { error } = await supabase
    .from("company_invitations")
    .delete()
    .eq("id", invitationId)
    .eq("company_id", companyId);

  if (error) {
    console.error("cancelCompanyInvitation", { companyId, invitationId, error });
    logSupabaseError("cancelCompanyInvitation", error);
    throw error;
  }

  recordActivityLog({
    action: "deleted",
    targetType: "invitation",
    targetId: invitationId,
    targetLabel: email,
    description: activityDescriptionInvitationCanceled(email),
  });
}

export async function updateCompanyMemberRole(
  memberId: string,
  role: CompanyMemberRole
): Promise<void> {
  if (role === "owner") {
    throw new Error("オーナー権限はここから変更できません");
  }

  const companyId = await resolveCompanyId();
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase
    .from("company_members")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", memberId)
    .eq("company_id", companyId)
    .neq("role", "owner");

  if (error) {
    console.error("updateCompanyMemberRole", { companyId, memberId, role, error });
    logSupabaseError("updateCompanyMemberRole", error);
    throw error;
  }
}

export async function removeCompanyMember(memberId: string): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const members = await fetchCompanyMembers(companyId);
  const member = members.find((m) => m.id === memberId);
  const memberLabel = member?.email ?? "";

  const { error } = await supabase
    .from("company_members")
    .delete()
    .eq("id", memberId)
    .eq("company_id", companyId)
    .neq("role", "owner")
    .neq("user_id", user?.id ?? "");

  if (error) {
    console.error("removeCompanyMember", { companyId, memberId, error });
    logSupabaseError("removeCompanyMember", error);
    throw error;
  }

  recordActivityLog({
    action: "member_removed",
    targetType: "member",
    targetId: member?.userId ?? memberId,
    targetLabel: memberLabel,
    description: activityDescriptionMemberRemoved(memberLabel),
  });
}

// switchActiveCompany は廃止（UI削除、会社固定運用）

export async function acceptCompanyInvitation(token: string): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (process.env.NODE_ENV === "development") {
    console.log("[acceptCompanyInvitation]", { token, userId: user?.id });
  }

  const { data, error } = await supabase.rpc("accept_company_invitation", {
    p_token: token,
  });

  if (error) {
    logAuthError("acceptCompanyInvitation failed", error);
    logSupabaseError("accept_company_invitation", error);
    throw mapInvitationRpcError(error);
  }

  const companyId = data as string;
  return companyId;
}

function mapInvitationRpcError(error: { message?: string }): Error {
  const msg = error.message ?? "";
  if (msg.includes("invitation_not_found")) {
    return new Error("招待が存在しません");
  }
  if (msg.includes("invitation_expired")) {
    return new Error("招待の有効期限が切れています");
  }
  if (msg.includes("invitation_already_accepted")) {
    return new Error("すでに承認済みです");
  }
  if (msg.includes("email_mismatch")) {
    return new Error("招待されたメールアドレスとログイン中のメールアドレスが一致しません");
  }
  return new Error(msg || "招待の受諾に失敗しました");
}

export async function getCurrentUserRole(
  companyId?: string
): Promise<CompanyMemberRole | null> {
  const members = await fetchCompanyMembers(companyId);
  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return members.find((m) => m.userId === user.id)?.role ?? null;
}

export async function appendCompanyActivityHistory(
  title: string,
  description: string
) {
  try {
    const projects = useProjectStore.getState().projects;
    const projectId = projects[0]?.id;
    if (!projectId) return;

    const event = await dbInsertHistory({
      projectId,
      type: "updated",
      title,
      description,
    });
    const store = useProjectStore.getState();
    store.hydrate({
      projects: store.projects,
      histories: [event, ...store.histories],
    });
  } catch (error) {
    console.error("appendCompanyActivityHistory", { title, error });
  }
}
