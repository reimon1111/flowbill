import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
} from "@/lib/constants";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import type { BillingDisplayStatus } from "@/lib/billing-status-theme";
import type { ProjectStatus } from "@/lib/types";

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const style = PROJECT_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium",
        style.bg,
        style.text,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", style.dot)} />
      {PROJECT_STATUS_LABELS[status]}
    </span>
  );
}

export function BillingProjectStatusBadge({
  status,
  className,
}: {
  status: BillingDisplayStatus;
  className?: string;
}) {
  return <BillingStatusBadge status={status} className={className} />;
}
