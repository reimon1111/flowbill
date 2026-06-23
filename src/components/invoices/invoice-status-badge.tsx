import { cn } from "@/lib/utils";
import type { InvoiceDocumentStatus } from "@/lib/types";

const LABELS: Record<InvoiceDocumentStatus, string> = {
  draft: "下書き",
  issued: "発行済み",
  sent: "送付済み",
  paid: "入金済み",
  overdue: "期限超過",
  cancelled: "キャンセル",
};

const STYLES: Record<InvoiceDocumentStatus, string> = {
  draft: "bg-zinc-100 text-zinc-600",
  issued: "bg-violet-50 text-violet-700",
  sent: "bg-sky-50 text-sky-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-600",
  cancelled: "bg-zinc-100 text-zinc-400",
};

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceDocumentStatus;
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

