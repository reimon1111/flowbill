import { resolveAuditUserLabel } from "@/lib/audit-user-display";
import {
  dbFetchActivityLogsForTarget,
  dbFetchRecentActivityLogs,
} from "@/lib/db/write-activity-log";
import type { ActivityLogRecord } from "@/lib/types/activity-log";
import type { CompanyMemberRecord } from "@/lib/types/company-membership";
import { useActivityLogStore } from "@/stores/activity-log-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function loadRecentActivityLogsToStore(limit = 10): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const logs = await dbFetchRecentActivityLogs(limit);
    useActivityLogStore.getState().hydrateRecent(logs);
  } catch (error) {
    console.error("loadRecentActivityLogsToStore", error);
  }
}

export async function fetchActivityLogsForTarget(
  targetType: ActivityLogRecord["targetType"],
  targetId: string,
  limit = 20
): Promise<ActivityLogRecord[]> {
  if (!isSupabaseConfigured()) return [];
  return dbFetchActivityLogsForTarget(targetType, targetId, limit);
}

export function formatActivityLogLine(
  log: ActivityLogRecord,
  members: CompanyMemberRecord[]
): string {
  const actor = resolveAuditUserLabel(log.actorUserId, members);
  const actorName = actor === "—" ? "不明なユーザー" : actor;
  return `${actorName}さんが${log.description}`;
}
