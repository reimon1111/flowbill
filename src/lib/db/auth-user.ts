import { getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** 現在ログイン中ユーザーの auth.users.id */
export async function getAuthUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw error;
  return user?.id ?? null;
}

export type AuditTimestamps = {
  createdBy?: string | null;
  updatedBy?: string | null;
};

/** insert 用: created_by / updated_by を付与 */
export function withCreateAudit<T extends Record<string, unknown>>(
  row: T,
  userId: string | null
): T & { created_by?: string | null; updated_by?: string | null } {
  if (!userId) return row;
  return { ...row, created_by: userId, updated_by: userId };
}

/** update 用: updated_by / updated_at を付与 */
export function withUpdateAudit<T extends Record<string, unknown>>(
  row: T,
  userId: string | null
): T & { updated_by?: string | null; updated_at?: string } {
  const now = new Date().toISOString();
  const withTimestamp = {
    ...row,
    updated_at:
      typeof row.updated_at === "string" && row.updated_at.length > 0
        ? row.updated_at
        : now,
  };
  if (!userId) return withTimestamp;
  return { ...withTimestamp, updated_by: userId };
}
