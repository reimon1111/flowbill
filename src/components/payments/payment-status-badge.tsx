import { cn } from "@/lib/utils";
import {
  getBillingStatusTheme,
  paymentStatusToBilling,
} from "@/lib/billing-status-theme";
import { PROJECT_PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { PaymentDisplayStatus } from "@/lib/payment-utils";
import type { ProjectPaymentStatus } from "@/lib/types";

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentDisplayStatus;
  className?: string;
}) {
  const theme = getBillingStatusTheme(paymentStatusToBilling(status));
  const label =
    PROJECT_PAYMENT_STATUS_LABELS[status as ProjectPaymentStatus] ??
    theme.statusLabel;
  return (
    <span className={cn(theme.badgeClass, className)}>
      {label}
    </span>
  );
}
