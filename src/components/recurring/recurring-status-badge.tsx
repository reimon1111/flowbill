import { cn } from "@/lib/utils";
import type { RecurringBillingStatus } from "@/lib/types";

const LABELS: Record<RecurringBillingStatus, string> = {
  active: "有効",
  paused: "停止中",
  ended: "終了",
};

const STYLES: Record<RecurringBillingStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  paused: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/60",
  ended: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200/60",
};

export function RecurringStatusBadge({
  status,
  className,
}: {
  status: RecurringBillingStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
}
