import { cn } from "@/lib/utils";
import {
  INVOICE_STATUS_LABELS,
  INVOICE_STATUS_STYLES,
  PROJECT_PAYMENT_STATUS_LABELS,
  PROJECT_PAYMENT_STATUS_STYLES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
} from "@/lib/constants";
import type {
  InvoiceStatus,
  ProjectPaymentStatus,
  ProjectStatus,
} from "@/lib/types";

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

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        INVOICE_STATUS_STYLES[status],
        className
      )}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}

export function ProjectPaymentStatusBadge({
  status,
  className,
}: {
  status: ProjectPaymentStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-0.5 text-xs font-medium",
        PROJECT_PAYMENT_STATUS_STYLES[status],
        className
      )}
    >
      {PROJECT_PAYMENT_STATUS_LABELS[status]}
    </span>
  );
}
