import { cn } from "@/lib/utils";
import {
  getBillingStatusTheme,
  paymentStatusToBilling,
} from "@/lib/billing-status-theme";
import type { PaymentDisplayStatus } from "@/lib/payment-utils";

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentDisplayStatus;
  className?: string;
}) {
  const theme = getBillingStatusTheme(paymentStatusToBilling(status));
  return (
    <span className={cn(theme.badgeClass, className)}>
      {theme.statusLabel}
    </span>
  );
}
