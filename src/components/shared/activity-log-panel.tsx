"use client";

import { useEffect, useState } from "react";
import { formatActivityLogLine, fetchActivityLogsForTarget } from "@/lib/services/activity-log";
import type { ActivityLogRecord, ActivityLogTargetType } from "@/lib/types/activity-log";
import { formatDateTime } from "@/lib/format";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { cn } from "@/lib/utils";

type ActivityLogPanelProps = {
  logs?: ActivityLogRecord[];
  targetType?: ActivityLogTargetType;
  targetId?: string;
  limit?: number;
  title?: string;
  className?: string;
  emptyMessage?: string;
};

export function ActivityLogPanel({
  logs: logsProp,
  targetType,
  targetId,
  limit = 20,
  title = "操作履歴",
  className,
  emptyMessage = "操作履歴はまだありません",
}: ActivityLogPanelProps) {
  const members = useCompanyMembershipStore((s) => s.members);
  const [fetchedLogs, setFetchedLogs] = useState<ActivityLogRecord[]>([]);
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);

  const requestKey =
    !logsProp && targetType && targetId ? `${targetType}:${targetId}` : null;
  const logs = logsProp ?? fetchedLogs;
  const showLoading = requestKey !== null && resolvedKey !== requestKey;

  useEffect(() => {
    if (logsProp || !targetType || !targetId) {
      return;
    }

    let cancelled = false;
    const key = `${targetType}:${targetId}`;

    void fetchActivityLogsForTarget(targetType, targetId, limit).then((rows) => {
      if (!cancelled) {
        setFetchedLogs(rows);
        setResolvedKey(key);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [logsProp, targetType, targetId, limit]);

  return (
    <section
      className={cn(
        "print-hidden rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-900/[0.02]",
        className
      )}
    >
      <h2 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h2>
      {showLoading ? (
        <p className="text-sm text-zinc-500">読み込み中...</p>
      ) : logs.length === 0 ? (
        <p className="text-sm text-zinc-500">{emptyMessage}</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
              <p className="text-xs tabular-nums text-zinc-400">
                {formatDateTime(log.createdAt)}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-800">
                {formatActivityLogLine(log, members)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type ActivityLogFeedProps = {
  logs: ActivityLogRecord[];
  className?: string;
};

/** ダッシュボード用のコンパクト一覧 */
export function ActivityLogFeed({ logs, className }: ActivityLogFeedProps) {
  const members = useCompanyMembershipStore((s) => s.members);

  if (logs.length === 0) {
    return (
      <p className={cn("text-sm text-zinc-500", className)}>
        操作履歴はまだありません
      </p>
    );
  }

  return (
    <ul className={cn("space-y-3", className)}>
      {logs.map((log) => (
        <li key={log.id} className="border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
          <p className="text-xs tabular-nums text-zinc-400">
            {formatDateTime(log.createdAt)}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-800">
            {formatActivityLogLine(log, members)}
          </p>
        </li>
      ))}
    </ul>
  );
}
