import type { InvoiceListItem, QuoteListItem } from "@/lib/types";
import type { PaymentListItem } from "@/lib/payment-utils";
import { getInvoiceListDisplayStatus } from "@/lib/payment-utils";
import { getQuoteExpiryDisplayStatus } from "@/lib/quote-expiry";
import {
  compareDateAsc,
  compareDateDesc,
  compareNumberAsc,
  compareNumberDesc,
} from "@/lib/list-query";

export type SortSelectOption<T extends string> = { value: T; label: string };

// --- 見積 ---

export type QuoteSortKey =
  | "created_desc"
  | "created_asc"
  | "expiry_asc"
  | "expiry_overdue"
  | "amount_desc"
  | "amount_asc";

export const QUOTE_SORT_DEFAULT: QuoteSortKey = "created_desc";

export const QUOTE_SORT_OPTIONS: SortSelectOption<QuoteSortKey>[] = [
  { value: "created_desc", label: "最新順" },
  { value: "created_asc", label: "古い順" },
  { value: "expiry_asc", label: "有効期限が近い" },
  { value: "expiry_overdue", label: "期限切れ優先" },
  { value: "amount_desc", label: "金額が高い" },
  { value: "amount_asc", label: "金額が低い" },
];

export const QUOTE_SORT_KEYS = QUOTE_SORT_OPTIONS.map((o) => o.value);

// --- 注文書 ---

export type OrderSortKey =
  | "created_desc"
  | "created_asc"
  | "amount_desc"
  | "amount_asc";

export const ORDER_SORT_DEFAULT: OrderSortKey = "created_desc";

export const ORDER_SORT_OPTIONS: SortSelectOption<OrderSortKey>[] = [
  { value: "created_desc", label: "最新順" },
  { value: "created_asc", label: "古い順" },
  { value: "amount_desc", label: "金額が高い" },
  { value: "amount_asc", label: "金額が低い" },
];

export const ORDER_SORT_KEYS = ORDER_SORT_OPTIONS.map((o) => o.value);

// --- 納品書 ---

export type DeliveryNoteSortKey =
  | "created_desc"
  | "created_asc"
  | "issue_desc"
  | "issue_asc";

export const DELIVERY_NOTE_SORT_DEFAULT: DeliveryNoteSortKey = "created_desc";

export const DELIVERY_NOTE_SORT_OPTIONS: SortSelectOption<DeliveryNoteSortKey>[] =
  [
    { value: "created_desc", label: "最新順" },
    { value: "created_asc", label: "古い順" },
    { value: "issue_desc", label: "納品日が新しい" },
    { value: "issue_asc", label: "納品日が古い" },
  ];

export const DELIVERY_NOTE_SORT_KEYS = DELIVERY_NOTE_SORT_OPTIONS.map(
  (o) => o.value
);

// --- 請求書 ---

export type InvoiceSortKey =
  | "created_desc"
  | "created_asc"
  | "due_asc"
  | "overdue_priority"
  | "unpaid_priority"
  | "amount_desc"
  | "amount_asc";

export const INVOICE_SORT_DEFAULT: InvoiceSortKey = "created_desc";

export const INVOICE_SORT_OPTIONS: SortSelectOption<InvoiceSortKey>[] = [
  { value: "created_desc", label: "最新順" },
  { value: "created_asc", label: "古い順" },
  { value: "due_asc", label: "支払期限が近い" },
  { value: "overdue_priority", label: "期限超過優先" },
  { value: "unpaid_priority", label: "未入金優先" },
  { value: "amount_desc", label: "金額が高い" },
  { value: "amount_asc", label: "金額が低い" },
];

export const INVOICE_SORT_KEYS = INVOICE_SORT_OPTIONS.map((o) => o.value);

// --- 領収書 ---

export type ReceiptSortKey =
  | "created_desc"
  | "created_asc"
  | "amount_desc"
  | "amount_asc";

export const RECEIPT_SORT_DEFAULT: ReceiptSortKey = "created_desc";

export const RECEIPT_SORT_OPTIONS: SortSelectOption<ReceiptSortKey>[] = [
  { value: "created_desc", label: "最新順" },
  { value: "created_asc", label: "古い順" },
  { value: "amount_desc", label: "金額が高い" },
  { value: "amount_asc", label: "金額が低い" },
];

export const RECEIPT_SORT_KEYS = RECEIPT_SORT_OPTIONS.map((o) => o.value);

// --- 入金管理 ---

export type PaymentSortKey =
  | "overdue_priority"
  | "due_asc"
  | "unpaid_priority"
  | "created_desc"
  | "amount_desc"
  | "amount_asc";

export const PAYMENT_SORT_DEFAULT: PaymentSortKey = "overdue_priority";

export const PAYMENT_SORT_OPTIONS: SortSelectOption<PaymentSortKey>[] = [
  { value: "overdue_priority", label: "期限超過優先" },
  { value: "due_asc", label: "支払期限が近い" },
  { value: "unpaid_priority", label: "未入金優先" },
  { value: "created_desc", label: "最新順" },
  { value: "amount_desc", label: "金額が高い" },
  { value: "amount_asc", label: "金額が低い" },
];

export const PAYMENT_SORT_KEYS = PAYMENT_SORT_OPTIONS.map((o) => o.value);

// --- 案件（既存維持・ラベルのみ短文化） ---

export type ProjectSortKey =
  | "created_desc"
  | "action_priority"
  | "confirmed_desc"
  | "confirmed_asc"
  | "completed_desc"
  | "completed_asc"
  | "updated_desc"
  | "amount_desc"
  | "amount_asc";

export const PROJECT_SORT_DEFAULT: ProjectSortKey = "created_desc";

export const PROJECT_SORT_OPTIONS: SortSelectOption<ProjectSortKey>[] = [
  { value: "created_desc", label: "最新順" },
  { value: "action_priority", label: "要対応順" },
  { value: "confirmed_desc", label: "確定日が新しい" },
  { value: "confirmed_asc", label: "確定日が古い" },
  { value: "completed_desc", label: "完了日が新しい" },
  { value: "completed_asc", label: "完了日が古い" },
  { value: "updated_desc", label: "更新が新しい" },
  { value: "amount_desc", label: "金額が高い" },
  { value: "amount_asc", label: "金額が低い" },
];

export const PROJECT_SORT_KEYS = PROJECT_SORT_OPTIONS.map((o) => o.value);

// --- 共通ソート対象 ---

export type CommercialListSortItem = {
  createdAt: string;
  issueDate: string;
  totalAmount: number;
};

function isQuoteExpired(expiryDate: string): boolean {
  return getQuoteExpiryDisplayStatus(expiryDate) === "expired";
}

function isUnpaidInvoice(inv: InvoiceListItem): boolean {
  const status = getInvoiceListDisplayStatus(inv);
  return status === "issued" || status === "sent" || status === "overdue";
}

function paymentUnpaidPriority(status: PaymentListItem["paymentStatus"]): number {
  if (status === "unpaid") return 0;
  if (status === "overdue") return 1;
  return 2;
}

export function sortQuotes<T extends QuoteListItem & { displayTotal?: number }>(
  items: T[],
  sortKey: QuoteSortKey,
  getTotal: (item: T) => number
): T[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return compareDateDesc(a.createdAt, b.createdAt);
      case "created_asc":
        return compareDateAsc(a.createdAt, b.createdAt);
      case "expiry_asc":
        return compareDateAsc(a.expiryDate, b.expiryDate);
      case "expiry_overdue": {
        const aExpired = isQuoteExpired(a.expiryDate) ? 0 : 1;
        const bExpired = isQuoteExpired(b.expiryDate) ? 0 : 1;
        if (aExpired !== bExpired) return aExpired - bExpired;
        return compareDateAsc(a.expiryDate, b.expiryDate);
      }
      case "amount_desc":
        return compareNumberDesc(getTotal(a), getTotal(b));
      case "amount_asc":
        return compareNumberAsc(getTotal(a), getTotal(b));
      default:
        return 0;
    }
  });
  return sorted;
}

export function sortCommercialDocuments<T extends CommercialListSortItem>(
  items: T[],
  sortKey: OrderSortKey | DeliveryNoteSortKey | ReceiptSortKey
): T[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return compareDateDesc(a.createdAt, b.createdAt);
      case "created_asc":
        return compareDateAsc(a.createdAt, b.createdAt);
      case "issue_desc":
        return compareDateDesc(a.issueDate, b.issueDate);
      case "issue_asc":
        return compareDateAsc(a.issueDate, b.issueDate);
      case "amount_desc":
        return compareNumberDesc(a.totalAmount, b.totalAmount);
      case "amount_asc":
        return compareNumberAsc(a.totalAmount, b.totalAmount);
      default:
        return 0;
    }
  });
  return sorted;
}

export function sortInvoices<T extends InvoiceListItem>(
  items: T[],
  sortKey: InvoiceSortKey
): T[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return compareDateDesc(a.createdAt, b.createdAt);
      case "created_asc":
        return compareDateAsc(a.createdAt, b.createdAt);
      case "due_asc":
        return compareDateAsc(a.dueDate, b.dueDate);
      case "overdue_priority": {
        const aOverdue =
          getInvoiceListDisplayStatus(a) === "overdue" ? 0 : 1;
        const bOverdue =
          getInvoiceListDisplayStatus(b) === "overdue" ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        return compareDateAsc(a.dueDate, b.dueDate);
      }
      case "unpaid_priority": {
        const aUnpaid = isUnpaidInvoice(a) ? 0 : 1;
        const bUnpaid = isUnpaidInvoice(b) ? 0 : 1;
        if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
        return compareDateDesc(a.createdAt, b.createdAt);
      }
      case "amount_desc":
        return compareNumberDesc(a.totalAmount, b.totalAmount);
      case "amount_asc":
        return compareNumberAsc(a.totalAmount, b.totalAmount);
      default:
        return 0;
    }
  });
  return sorted;
}

export function getPaymentListYearDate(item: PaymentListItem): string {
  if (item.paymentStatus === "paid") {
    return item.updatedAt || item.dueDate;
  }
  return item.dueDate;
}

export function sortPayments(
  items: PaymentListItem[],
  sortKey: PaymentSortKey
): PaymentListItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "overdue_priority": {
        if (a.paymentStatus === "overdue" && b.paymentStatus !== "overdue") {
          return -1;
        }
        if (b.paymentStatus === "overdue" && a.paymentStatus !== "overdue") {
          return 1;
        }
        return compareDateAsc(a.dueDate, b.dueDate);
      }
      case "due_asc":
        return compareDateAsc(a.dueDate, b.dueDate);
      case "unpaid_priority": {
        const diff =
          paymentUnpaidPriority(a.paymentStatus) -
          paymentUnpaidPriority(b.paymentStatus);
        if (diff !== 0) return diff;
        return compareDateAsc(a.dueDate, b.dueDate);
      }
      case "created_desc":
        return compareDateDesc(a.createdAt, b.createdAt);
      case "amount_desc":
        return compareNumberDesc(a.totalAmount, b.totalAmount);
      case "amount_asc":
        return compareNumberAsc(a.totalAmount, b.totalAmount);
      default:
        return 0;
    }
  });
  return sorted;
}

// --- 案件 ---

function getProjectActionPriority(
  project: import("@/lib/types").ProjectListItem
): number {
  if (project.status === "lost") return 90;

  if (project.status === "completed") {
    if (project.paymentStatus === "overdue") return 0;
    if (
      project.invoiceStatus === "not_created" ||
      project.invoiceStatus === "draft"
    ) {
      return 10;
    }
    if (project.paymentStatus === "unpaid") return 20;
    if (project.paymentStatus === "paid") return 80;
  }

  if (project.status === "ordered" || project.status === "in_progress") {
    return 15;
  }

  if (project.status === "estimate") return 30;
  return 50;
}

export function getProjectListYearDate(
  project: import("@/lib/types").ProjectListItem
): string {
  return project.confirmedDate || project.createdAt;
}

export function sortProjects(
  items: import("@/lib/types").ProjectListItem[],
  sortKey: ProjectSortKey
): import("@/lib/types").ProjectListItem[] {
  const sorted = [...items];
  sorted.sort((a, b) => {
    switch (sortKey) {
      case "created_desc":
        return compareDateDesc(a.createdAt, b.createdAt);
      case "action_priority": {
        const diff = getProjectActionPriority(a) - getProjectActionPriority(b);
        if (diff !== 0) return diff;
        return compareDateDesc(a.updatedAt, b.updatedAt);
      }
      case "confirmed_desc":
        return compareDateDesc(a.confirmedDate, b.confirmedDate);
      case "confirmed_asc":
        return compareDateAsc(a.confirmedDate, b.confirmedDate);
      case "completed_desc":
        return compareDateDesc(a.completedDate, b.completedDate);
      case "completed_asc":
        return compareDateAsc(a.completedDate, b.completedDate);
      case "updated_desc":
        return compareDateDesc(a.updatedAt, b.updatedAt);
      case "amount_desc":
        return compareNumberDesc(a.amount, b.amount);
      case "amount_asc":
        return compareNumberAsc(a.amount, b.amount);
      default:
        return 0;
    }
  });
  return sorted;
}
