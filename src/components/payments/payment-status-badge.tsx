import { cn } from "@/lib/utils";
import type { PaymentDisplayStatus } from "@/lib/payment-utils";

const LABELS: Record<PaymentDisplayStatus, string> = {
  unpaid: "未入金",
  paid: "入金済",
  overdue: "期限超過",
};

const STYLES: Record<PaymentDisplayStatus, string> = {
  unpaid: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/60",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/50",
  overdue: "bg-red-50 text-red-700 ring-1 ring-red-200/70 font-medium",
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentDisplayStatus;
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
