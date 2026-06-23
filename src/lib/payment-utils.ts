import type { InvoiceDocumentStatus, InvoiceListItem, InvoiceRecord } from "@/lib/types";

/** 入金管理画面用の表示ステータス */
export type PaymentDisplayStatus = "unpaid" | "paid" | "overdue";

export function isInvoiceOverdue(dueDate: string): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate + "T23:59:59");
  return due < new Date();
}

/** 請求書の実効ステータス（期限超過は表示上で判定） */
export function getInvoiceDisplayStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate">
): PaymentDisplayStatus | "draft" | "cancelled" {
  if (inv.status === "paid") return "paid";
  if (inv.status === "cancelled") return "cancelled";
  if (inv.status === "draft") return "draft";
  if (inv.status === "overdue" || isInvoiceOverdue(inv.dueDate)) {
    return "overdue";
  }
  if (inv.status === "issued" || inv.status === "sent") {
    return "unpaid";
  }
  return "unpaid";
}

/** 入金管理一覧に載せる請求書か */
export function isPaymentTrackable(
  inv: Pick<InvoiceRecord, "status" | "dueDate">
): boolean {
  const ds = getInvoiceDisplayStatus(inv);
  return ds === "unpaid" || ds === "paid" || ds === "overdue";
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

/** 請求書一覧の表示ステータス（期限超過は表示上で判定） */
export function getInvoiceListDisplayStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate">
): InvoiceDocumentStatus {
  const ds = getInvoiceDisplayStatus(inv);
  if (ds === "overdue") return "overdue";
  if (ds === "paid") return "paid";
  return inv.status;
}

export function enrichPaymentListItem(inv: InvoiceListItem): PaymentListItem | null {
  const paymentStatus = getInvoiceDisplayStatus(inv);
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
