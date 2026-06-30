import type { ActivityLogInsert, ActivityLogRecord } from "@/lib/types/activity-log";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { getAuthUserId } from "@/lib/db/auth-user";
import { generateId } from "@/lib/db/ids";
import {
  activityLogFromRow,
  activityLogToRow,
  type ActivityLogRow,
} from "@/lib/db/activity-log-mappers";
import { useActivityLogStore } from "@/stores/activity-log-store";

/**
 * 操作履歴を記録する。失敗しても例外を投げず、本体処理を止めない。
 */
export function recordActivityLog(input: ActivityLogInsert): void {
  void (async () => {
    try {
      const record = await dbInsertActivityLog(input);
      if (record) {
        useActivityLogStore.getState().prepend(record);
      }
    } catch (error) {
      console.error("recordActivityLog failed", { input, error });
    }
  })();
}

export async function dbInsertActivityLog(
  input: ActivityLogInsert
): Promise<ActivityLogRecord | null> {
  try {
    const companyId = await resolveCompanyId();
    const actorUserId = await getAuthUserId();
    const now = new Date().toISOString();
    const id = generateId("alog_");
    const row = activityLogToRow(companyId, actorUserId, {
      id,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      targetLabel: input.targetLabel,
      description: input.description,
      metadata: input.metadata,
      createdAt: now,
    });

    const supabase = getSupabaseClient();
    const { error } = await supabase.from("activity_logs").insert(row);
    if (error) {
      console.error("dbInsertActivityLog", { input, error });
      return null;
    }

    return activityLogFromRow(row);
  } catch (error) {
    console.error("dbInsertActivityLog", { input, error });
    return null;
  }
}

export async function dbFetchRecentActivityLogs(
  limit = 10
): Promise<ActivityLogRecord[]> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("dbFetchRecentActivityLogs", { companyId, error });
    throw error;
  }

  return (data as ActivityLogRow[]).map(activityLogFromRow);
}

export async function dbFetchActivityLogsForTarget(
  targetType: ActivityLogRecord["targetType"],
  targetId: string,
  limit = 20
): Promise<ActivityLogRecord[]> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .eq("company_id", companyId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("dbFetchActivityLogsForTarget", {
      companyId,
      targetType,
      targetId,
      error,
    });
    throw error;
  }

  return (data as ActivityLogRow[]).map(activityLogFromRow);
}
