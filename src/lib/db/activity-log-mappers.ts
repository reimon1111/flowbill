import type { ActivityLogRecord } from "@/lib/types/activity-log";

function toIso(v: string | null | undefined): string {
  if (!v) return new Date().toISOString();
  return v.includes("T") ? v : `${v}T00:00:00.000Z`;
}

export type ActivityLogRow = {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  target_label: string;
  description: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export function activityLogFromRow(row: ActivityLogRow): ActivityLogRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    actorUserId: row.actor_user_id,
    action: row.action as ActivityLogRecord["action"],
    targetType: row.target_type as ActivityLogRecord["targetType"],
    targetId: row.target_id,
    targetLabel: row.target_label,
    description: row.description,
    metadata: row.metadata ?? {},
    createdAt: toIso(row.created_at),
  };
}

export function activityLogToRow(
  companyId: string,
  actorUserId: string | null,
  log: ActivityLogInsertRow
): ActivityLogRow {
  return {
    id: log.id,
    company_id: companyId,
    actor_user_id: actorUserId,
    action: log.action,
    target_type: log.targetType,
    target_id: log.targetId,
    target_label: log.targetLabel,
    description: log.description,
    metadata: log.metadata ?? {},
    created_at: log.createdAt,
  };
}

export type ActivityLogInsertRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
};
