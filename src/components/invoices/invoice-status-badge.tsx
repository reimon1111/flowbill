import { cn } from "@/lib/utils";
import {
  getBillingStatusTheme,
  invoiceDocumentStatusToBilling,
} from "@/lib/billing-status-theme";
import type { InvoiceDocumentStatus } from "@/lib/types";

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceDocumentStatus;
  className?: string;
}) {
  const theme = getBillingStatusTheme(invoiceDocumentStatusToBilling(status));
  return (
    <span className={cn(theme.badgeClass, className)}>
      {theme.statusLabel}
    </span>
  );
}
