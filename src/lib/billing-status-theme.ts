import {
  getInvoicePaymentStatus,
  getProjectInvoiceState,
  type ProjectInvoiceState,
} from "@/lib/invoice-state";
import type {
  InvoiceDocumentStatus,
  InvoiceRecord,
  ProjectStatus,
} from "@/lib/types";
import type { PaymentDisplayStatus } from "@/lib/payment-utils";
import {
  buildProjectInvoiceHref,
  resolveProjectInvoiceNavigation,
} from "@/lib/project-invoice-actions";

/** 請求・入金の統一表示ステータス */
export type BillingDisplayStatus =
  | "unissued"
  | "unpaid"
  | "overdue"
  | "paid"
  | "multiple"
  | "cancelled";

export type BillingStatusTheme = {
  statusLabel: string;
  actionLabel: string;
  badgeClass: string;
  buttonClass: string;
  buttonOutlineClass: string;
  cardClass: string;
  textAccentClass: string;
  kpiClass: string;
  kpiTextClass: string;
};

const BADGE =
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium";

export const BILLING_STATUS_THEME: Record<BillingDisplayStatus, BillingStatusTheme> =
  {
    unissued: {
      statusLabel: "未発行",
      actionLabel: "請求書発行",
      badgeClass: `${BADGE} border-blue-200 bg-blue-50 text-blue-700`,
      buttonClass:
        "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
      buttonOutlineClass:
        "border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
      cardClass: "border-blue-200/80 bg-blue-50/40",
      textAccentClass: "font-medium text-blue-700",
      kpiClass: "border-blue-200/70 bg-blue-50/50",
      kpiTextClass: "text-blue-800",
    },
    unpaid: {
      statusLabel: "未入金",
      actionLabel: "請求書を確認",
      badgeClass: `${BADGE} border-amber-200 bg-amber-50 text-amber-700`,
      buttonClass:
        "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
      buttonOutlineClass:
        "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
      cardClass: "border-amber-200/80 bg-amber-50/40",
      textAccentClass: "font-medium text-amber-700",
      kpiClass: "border-amber-200/70 bg-amber-50/50",
      kpiTextClass: "text-amber-800",
    },
    overdue: {
      statusLabel: "期限超過",
      actionLabel: "期限超過を確認",
      badgeClass: `${BADGE} border-rose-200 bg-rose-50 text-rose-700`,
      buttonClass:
        "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      buttonOutlineClass:
        "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      cardClass: "border-rose-200/80 bg-rose-50/40",
      textAccentClass: "font-medium text-rose-700",
      kpiClass: "border-rose-200/70 bg-rose-50/50",
      kpiTextClass: "text-rose-800",
    },
    paid: {
      statusLabel: "入金済み",
      actionLabel: "入金済み",
      badgeClass: `${BADGE} border-emerald-200 bg-emerald-50 text-emerald-700`,
      buttonClass:
        "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      buttonOutlineClass:
        "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      cardClass: "border-emerald-200/80 bg-emerald-50/40",
      textAccentClass: "font-medium text-emerald-700",
      kpiClass: "border-emerald-200/70 bg-emerald-50/50",
      kpiTextClass: "text-emerald-800",
    },
    multiple: {
      statusLabel: "複数請求",
      actionLabel: "請求書一覧",
      badgeClass: `${BADGE} border-slate-200 bg-slate-50 text-slate-700`,
      buttonClass:
        "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
      buttonOutlineClass:
        "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
      cardClass: "border-slate-200/80 bg-slate-50/40",
      textAccentClass: "font-medium text-slate-700",
      kpiClass: "border-slate-200/70 bg-slate-50/50",
      kpiTextClass: "text-slate-800",
    },
    cancelled: {
      statusLabel: "キャンセル済み",
      actionLabel: "キャンセル済み",
      badgeClass: `${BADGE} border-zinc-200 bg-zinc-50 text-zinc-600`,
      buttonClass:
        "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100",
      buttonOutlineClass:
        "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100",
      cardClass: "border-zinc-200/80 bg-zinc-50/40",
      textAccentClass: "font-medium text-zinc-600",
      kpiClass: "border-zinc-200/70 bg-zinc-50/50",
      kpiTextClass: "text-zinc-700",
    },
  };

export function getBillingStatusTheme(
  status: BillingDisplayStatus
): BillingStatusTheme {
  return BILLING_STATUS_THEME[status];
}

/** 案件の請求・入金表示ステータス（完了案件のみ） */
export function getProjectBillingDisplayStatus(
  state: ProjectInvoiceState,
  projectStatus: ProjectStatus
): BillingDisplayStatus | null {
  if (projectStatus !== "completed") return null;

  if (state.hasMultipleActive) return "multiple";

  if (
    state.invoiceStatus === "not_created" ||
    state.invoiceStatus === "draft" ||
    state.billableInvoices.length === 0
  ) {
    return "unissued";
  }

  if (state.paymentStatus === "paid") return "paid";
  if (state.paymentStatus === "overdue") return "overdue";
  if (state.paymentStatus === "unpaid") return "unpaid";

  return "unissued";
}

export function paymentStatusToBilling(
  status: PaymentDisplayStatus
): BillingDisplayStatus {
  return status;
}

export function invoiceDocumentStatusToBilling(
  status: InvoiceDocumentStatus
): BillingDisplayStatus {
  switch (status) {
    case "draft":
      return "unissued";
    case "issued":
    case "sent":
      return "unpaid";
    case "paid":
      return "paid";
    case "overdue":
      return "overdue";
    case "cancelled":
      return "cancelled";
  }
}

export function getInvoiceBillingDisplayStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">,
  today?: Date
): BillingDisplayStatus {
  const payment = getInvoicePaymentStatus(inv, today);
  if (payment === "cancelled") return "cancelled";
  if (payment === "draft") return "unissued";
  if (payment === "paid") return "paid";
  if (payment === "overdue") return "overdue";
  return "unpaid";
}

/** 請求アクションボタン押下時の遷移先 */
export function getProjectBillingViewHref(
  projectId: string,
  invoices: InvoiceRecord[]
): string {
  const state = getProjectInvoiceState(projectId, invoices);
  if (state.hasMultipleActive) {
    return `/projects/${projectId}?tab=invoice`;
  }
  const primary = state.primaryInvoice ?? state.billableInvoices[0];
  if (primary) {
    return `/invoices/${primary.id}`;
  }
  const nav = resolveProjectInvoiceNavigation(invoices, projectId);
  return buildProjectInvoiceHref(projectId, nav);
}
