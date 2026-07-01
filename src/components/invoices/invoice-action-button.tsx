"use client";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { InvoiceDocumentStatus } from "@/lib/types";

export type InvoiceActionType = "mark_issued" | "mark_sent" | "mark_paid" | "cancel";

const LABELS: Record<InvoiceActionType, string> = {
  mark_issued: "発行済みにする",
  mark_sent: "送付済みにする",
  mark_paid: "入金済みにする",
  cancel: "キャンセル",
};

export function getInvoiceQuickActions(
  status: InvoiceDocumentStatus
): InvoiceActionType[] {
  switch (status) {
    case "draft":
      return ["mark_issued"];
    case "issued":
    case "overdue":
      return ["mark_sent", "mark_paid", "cancel"];
    case "sent":
      return ["mark_paid", "cancel"];
    default:
      return [];
  }
}

export function InvoiceActionButton({
  action,
  onAction,
  className,
  disabled,
}: {
  action: InvoiceActionType;
  onAction: (action: InvoiceActionType) => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const variant =
    action === "mark_paid" ? "default" : action === "cancel" ? "outline" : "outline";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAction(action)}
      className={cn(
        buttonVariants({ variant }),
        "h-10 min-h-10 rounded-xl sm:h-9",
        action === "mark_paid" ? "bg-emerald-600 text-white hover:bg-emerald-500" : "",
        className
      )}
    >
      {LABELS[action]}
    </button>
  );
}

