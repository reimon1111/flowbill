import { cn } from "@/lib/utils";
import {
  getBillingStatusTheme,
  type BillingDisplayStatus,
} from "@/lib/billing-status-theme";

export function BillingStatusBadge({
  status,
  className,
}: {
  status: BillingDisplayStatus;
  className?: string;
}) {
  const theme = getBillingStatusTheme(status);
  return (
    <span className={cn(theme.badgeClass, className)}>
      {theme.statusLabel}
    </span>
  );
}
