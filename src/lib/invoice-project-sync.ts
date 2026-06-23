import type {
  InvoiceRecord,
  InvoiceStatus,
  ProjectPaymentStatus,
} from "@/lib/types";

/** 請求書の増減・キャンセル後に案件の請求/入金状態を再計算 */
export function resolveProjectFieldsAfterInvoiceChange(
  projectId: string,
  invoices: InvoiceRecord[],
  options?: { excludeInvoiceId?: string }
): { invoiceStatus: InvoiceStatus; paymentStatus: ProjectPaymentStatus } {
  const scoped = invoices
    .filter((inv) => inv.projectId === projectId)
    .filter((inv) => inv.id !== options?.excludeInvoiceId);

  const active = scoped.filter((inv) => inv.status !== "cancelled");
  const billable = active.filter((inv) => inv.status !== "draft");

  let invoiceStatus: InvoiceStatus = "not_created";
  if (billable.some((inv) => inv.status === "sent")) {
    invoiceStatus = "sent";
  } else if (
    billable.some((inv) => inv.status === "issued" || inv.status === "overdue")
  ) {
    invoiceStatus = "issued";
  } else if (active.some((inv) => inv.status === "draft")) {
    invoiceStatus = "draft";
  }

  let paymentStatus: ProjectPaymentStatus = "unpaid";
  if (billable.some((inv) => inv.status === "paid")) {
    paymentStatus = "paid";
  } else if (billable.some((inv) => inv.status === "overdue")) {
    paymentStatus = "overdue";
  }

  return { invoiceStatus, paymentStatus };
}
