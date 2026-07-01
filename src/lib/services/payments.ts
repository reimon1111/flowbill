import type { PaymentListItem } from "@/lib/payment-utils";
import { enrichPaymentListItem, getInvoiceDisplayStatus, isPaymentTrackable } from "@/lib/payment-utils";
import { useInvoiceStore } from "@/stores/invoice-store";
import { updateInvoiceStatus } from "@/lib/services/invoices";
import { syncCustomerProjectCounts } from "@/lib/services/projects";
import { assertCanWriteBusinessData } from "@/lib/guards/write-access";

export async function getPaymentListItems(): Promise<PaymentListItem[]> {
  return useInvoiceStore
    .getState()
    .getListItems()
    .map(enrichPaymentListItem)
    .filter((x): x is PaymentListItem => x !== null)
    .sort((a, b) => {
      if (a.paymentStatus === "overdue" && b.paymentStatus !== "overdue") return -1;
      if (b.paymentStatus === "overdue" && a.paymentStatus !== "overdue") return 1;
      return a.dueDate.localeCompare(b.dueDate);
    });
}

export async function markInvoicePaid(invoiceId: string) {
  assertCanWriteBusinessData();
  const updated = await updateInvoiceStatus(invoiceId, "paid");
  syncCustomerProjectCounts();
  return updated;
}

export type PaymentDashboardStats = {
  unpaidCount: number;
  overdueCount: number;
  dueThisMonthAmount: number;
  paidThisMonthAmount: number;
  overdueItems: Array<{
    invoiceId: string;
    invoiceNumber: string;
    customerName: string;
    projectName: string;
    totalAmount: number;
    daysOverdue: number;
  }>;
};

export async function getPaymentDashboardStatsAsync(): Promise<PaymentDashboardStats> {
  return getPaymentDashboardStats();
}

export function getPaymentDashboardStats(): PaymentDashboardStats {
  const items = useInvoiceStore
    .getState()
    .getListItems()
    .map(enrichPaymentListItem)
    .filter((x): x is PaymentListItem => x !== null);

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const isThisMonth = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.getFullYear() === y && d.getMonth() === m;
  };

  const unpaid = items.filter((i) => i.paymentStatus === "unpaid");
  const overdue = items.filter((i) => i.paymentStatus === "overdue");
  const dueThisMonth = items.filter(
    (i) =>
      (i.paymentStatus === "unpaid" || i.paymentStatus === "overdue") &&
      isThisMonth(i.dueDate)
  );
  const paidThisMonth = items.filter(
    (i) => i.paymentStatus === "paid" && isThisMonth(i.updatedAt.slice(0, 10))
  );

  return {
    unpaidCount: unpaid.length + overdue.length,
    overdueCount: overdue.length,
    dueThisMonthAmount: dueThisMonth.reduce((s, i) => s + i.totalAmount, 0),
    paidThisMonthAmount: paidThisMonth.reduce((s, i) => s + i.totalAmount, 0),
    overdueItems: overdue
      .map((i) => ({
        invoiceId: i.id,
        invoiceNumber: i.invoiceNumber,
        customerName: i.customerName,
        projectName: i.projectName,
        totalAmount: i.totalAmount,
        daysOverdue: i.daysOverdue,
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 8),
  };
}

export function isUnpaidInvoice(inv: Parameters<typeof isPaymentTrackable>[0]) {
  const ds = getInvoiceDisplayStatus(inv);
  return ds === "unpaid" || ds === "overdue";
}

export { isPaymentTrackable };
