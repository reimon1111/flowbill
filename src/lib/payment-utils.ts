import type { InvoiceListItem, InvoiceRecord } from "@/lib/types";
import {
  getInvoiceListDisplayStatus,
  getInvoicePaymentStatus,
  isBillableInvoice,
  isDueDatePast,
  isInvoicePaymentTrackable,
  type InvoicePaymentDisplayStatus,
} from "@/lib/invoice-state";

/** 入金管理画面用の表示ステータス */
export type PaymentDisplayStatus = InvoicePaymentDisplayStatus;

export function isInvoiceOverdue(dueDate: string, today: Date = new Date()): boolean {
  return isDueDatePast(dueDate, today);
}

/** 請求書の実効ステータス（期限超過は due_date から動的判定） */
export function getInvoiceDisplayStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">,
  today?: Date
): PaymentDisplayStatus | "draft" | "cancelled" {
  return getInvoicePaymentStatus(inv, today);
}

/** 入金管理一覧に載せる請求書か */
export function isPaymentTrackable(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">
): boolean {
  return isInvoicePaymentTrackable(inv);
}

export function getDaysUntilDue(dueDate: string): number {
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(dueDate + "T00:00:00"));
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function getDaysOverdue(dueDate: string): number {
  if (!isInvoiceOverdue(dueDate)) return 0;
  return Math.abs(getDaysUntilDue(dueDate));
}

export function formatDaysUntilDue(dueDate: string, displayStatus: PaymentDisplayStatus): string {
  if (displayStatus === "paid") return "—";
  const days = getDaysUntilDue(dueDate);
  if (displayStatus === "overdue") {
    const over = getDaysOverdue(dueDate);
    return over === 0 ? "本日期限" : `${over}日超過`;
  }
  if (days === 0) return "今日まで";
  if (days > 0) return `あと${days}日`;
  return `${Math.abs(days)}日超過`;
}

export type PaymentListItem = InvoiceListItem & {
  paymentStatus: PaymentDisplayStatus;
  daysLabel: string;
  daysUntilDue: number;
  daysOverdue: number;
};

export { getInvoiceListDisplayStatus };

export function enrichPaymentListItem(inv: InvoiceListItem): PaymentListItem | null {
  if (!isBillableInvoice(inv)) return null;
  const paymentStatus = getInvoicePaymentStatus(inv);
  if (paymentStatus === "draft" || paymentStatus === "cancelled") return null;
  const daysUntilDue = getDaysUntilDue(inv.dueDate);
  const daysOverdue = paymentStatus === "overdue" ? getDaysOverdue(inv.dueDate) : 0;
  return {
    ...inv,
    paymentStatus,
    daysUntilDue,
    daysOverdue,
    daysLabel: formatDaysUntilDue(inv.dueDate, paymentStatus),
  };
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
