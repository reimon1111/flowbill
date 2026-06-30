"use client";

import { resolveAuditUserLabel } from "@/lib/audit-user-display";
import { formatDateTime } from "@/lib/format";
import type { AuditMetadata } from "@/lib/types/audit";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { cn } from "@/lib/utils";

type AuditTrailPanelProps = {
  audit: AuditMetadata;
  className?: string;
  compact?: boolean;
};

export function AuditTrailPanel({
  audit,
  className,
  compact = false,
}: AuditTrailPanelProps) {
  const members = useCompanyMembershipStore((s) => s.members);
  const createdLabel = resolveAuditUserLabel(audit.createdBy, members);
  const updatedLabel = resolveAuditUserLabel(audit.updatedBy, members);

  if (compact) {
    return (
      <p className={cn("truncate text-[11px] leading-none text-zinc-400", className)}>
        更新 {updatedLabel} · {formatDateTime(audit.updatedAt)}
      </p>
    );
  }

  return (
    <section
      className={cn(
        "print-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/60 px-5 py-4 text-sm",
        className
      )}
    >
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-500">作成者</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">{createdLabel}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">作成日</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {formatDateTime(audit.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">最終更新者</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">{updatedLabel}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">最終更新日</dt>
          <dd className="mt-0.5 font-medium text-zinc-900">
            {formatDateTime(audit.updatedAt)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
