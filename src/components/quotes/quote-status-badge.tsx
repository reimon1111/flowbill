import { cn } from "@/lib/utils";
import type { QuoteStatus } from "@/lib/types";

const LABELS: Record<QuoteStatus, string> = {
  draft: "下書き",
  sent: "提出済み",
  accepted: "承認",
  rejected: "否認",
};

const STYLES: Record<QuoteStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  sent: "bg-sky-50 text-sky-700",
  accepted: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-600",
};

export function QuoteStatusBadge({
  status,
  className,
}: {
  status: QuoteStatus;
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

