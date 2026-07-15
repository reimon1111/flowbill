import type {
  InvoiceDocumentStatus,
  InvoiceRecord,
  InvoiceStatus,
  ProjectPaymentStatus,
} from "@/lib/types";

export type InvoicePaymentDisplayStatus = "unpaid" | "paid" | "overdue";

/** 削除済み（deleted_at が設定されている） */
export function isDeletedInvoice(
  inv: Pick<InvoiceRecord, "deletedAt">
): boolean {
  return inv.deletedAt != null;
}

/** @deprecated isDeletedInvoice を使用 */
export const isInvoiceDeleted = isDeletedInvoice;

/** キャンセル済み */
export function isCanceledInvoice(
  inv: Pick<InvoiceRecord, "status">
): boolean {
  return inv.status === "cancelled";
}

/** @deprecated isCanceledInvoice を使用 */
export const isInvoiceCancelled = isCanceledInvoice;

/** 有効な請求書（削除・キャンセル以外） */
export function isActiveInvoice(
  inv: Pick<InvoiceRecord, "status" | "deletedAt">
): boolean {
  return !isDeletedInvoice(inv) && !isCanceledInvoice(inv);
}

/** @deprecated isActiveInvoice を使用 */
export const isInvoiceActiveForProject = isActiveInvoice;

/** 集計・入金管理の対象 */
export function isBillableInvoice(
  inv: Pick<InvoiceRecord, "status" | "deletedAt">
): boolean {
  return isActiveInvoice(inv);
}

/** 通常一覧に表示 */
export function isInvoiceInDefaultList(
  inv: Pick<InvoiceRecord, "status" | "deletedAt">
): boolean {
  return isBillableInvoice(inv);
}

export function filterVisibleInvoices(invoices: InvoiceRecord[]): InvoiceRecord[] {
  return invoices.filter((inv) => !isDeletedInvoice(inv));
}

export function filterBillableInvoices(invoices: InvoiceRecord[]): InvoiceRecord[] {
  return invoices.filter(isBillableInvoice);
}

export function filterProjectInvoices(
  invoices: InvoiceRecord[],
  projectId: string,
  options?: {
    includeDeleted?: boolean;
    includeCancelled?: boolean;
  }
): InvoiceRecord[] {
  const includeDeleted = options?.includeDeleted ?? false;
  const includeCancelled = options?.includeCancelled ?? false;

  return invoices
    .filter((inv) => inv.projectId === projectId)
    .filter((inv) => includeDeleted || !isDeletedInvoice(inv))
    .filter((inv) => includeCancelled || !isCanceledInvoice(inv))
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
}

export function getActiveInvoicesForProject(
  invoices: InvoiceRecord[],
  projectId: string
): InvoiceRecord[] {
  return filterProjectInvoices(invoices, projectId, {
    includeCancelled: false,
    includeDeleted: false,
  });
}

export function getPrimaryProjectInvoice(
  invoices: InvoiceRecord[],
  projectId: string
): InvoiceRecord | null {
  return getActiveInvoicesForProject(invoices, projectId)[0] ?? null;
}

export function hasActiveInvoiceForProject(
  invoices: InvoiceRecord[],
  projectId: string
): boolean {
  return getActiveInvoicesForProject(invoices, projectId).length > 0;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 支払期限が今日より前か（未入金判定の前提で使用） */
export function isDueDatePast(dueDate: string, today: Date = new Date()): boolean {
  if (!dueDate) return false;
  const due = startOfDay(new Date(dueDate + "T00:00:00"));
  return due.getTime() < startOfDay(today).getTime();
}

/** 有効かつ未入金の請求書が期限超過か */
export function isInvoiceOverdue(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">,
  today: Date = new Date()
): boolean {
  if (!isBillableInvoice(inv)) return false;
  if (inv.status === "paid" || inv.status === "draft") return false;
  return isDueDatePast(inv.dueDate, today);
}

/** 入金管理・集計用の支払ステータス（期限超過は due_date から動的判定） */
export function getInvoicePaymentStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">,
  today: Date = new Date()
): InvoicePaymentDisplayStatus | "draft" | "cancelled" {
  if (isCanceledInvoice(inv)) return "cancelled";
  if (isDeletedInvoice(inv)) return "cancelled";
  if (inv.status === "paid") return "paid";
  if (inv.status === "draft") return "draft";
  if (isInvoiceOverdue(inv, today)) return "overdue";
  if (inv.status === "issued" || inv.status === "sent" || inv.status === "overdue") {
    return "unpaid";
  }
  return "unpaid";
}

/** 請求書一覧バッジ用ステータス */
export function getInvoiceListDisplayStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">,
  today: Date = new Date()
): InvoiceDocumentStatus {
  const payment = getInvoicePaymentStatus(inv, today);
  if (payment === "overdue") return "overdue";
  if (payment === "paid") return "paid";
  if (payment === "cancelled") return "cancelled";
  if (payment === "draft") return "draft";
  return inv.status === "sent" ? "sent" : "issued";
}

/** 入金管理一覧に載せる請求書か */
export function isInvoicePaymentTrackable(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">
): boolean {
  if (!isBillableInvoice(inv)) return false;
  const ps = getInvoicePaymentStatus(inv);
  return ps === "unpaid" || ps === "paid" || ps === "overdue";
}

/** 未入金集計対象か */
export function isInvoiceUnpaidForAggregation(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">
): boolean {
  const ps = getInvoicePaymentStatus(inv);
  return ps === "unpaid" || ps === "overdue";
}

/** 発行済み（下書き以外の有効請求書）があるか */
export function isIssuedBillableInvoice(
  inv: Pick<InvoiceRecord, "status" | "deletedAt">
): boolean {
  if (!isBillableInvoice(inv)) return false;
  return inv.status !== "draft";
}

/**
 * due_date 変更後に DB/store に保存すべき status。
 * 期限超過は due_date から決定し、未来日なら overdue から issued/sent に戻す。
 */
export function resolveStoredInvoiceStatus(
  inv: Pick<InvoiceRecord, "status" | "dueDate" | "deletedAt">,
  today: Date = new Date()
): InvoiceDocumentStatus {
  if (isCanceledInvoice(inv) || isDeletedInvoice(inv)) {
    return inv.status;
  }
  if (inv.status === "paid" || inv.status === "draft") {
    return inv.status;
  }
  if (isDueDatePast(inv.dueDate, today)) {
    return "overdue";
  }
  if (inv.status === "sent") return "sent";
  if (inv.status === "overdue" || inv.status === "issued") return "issued";
  return inv.status;
}

export function applyStoredInvoiceStatus(invoice: InvoiceRecord): InvoiceRecord {
  const status = resolveStoredInvoiceStatus(invoice);
  if (status === invoice.status) return invoice;
  return {
    ...invoice,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export type ProjectInvoiceState = {
  invoiceStatus: InvoiceStatus;
  paymentStatus: ProjectPaymentStatus;
  activeInvoices: InvoiceRecord[];
  billableInvoices: InvoiceRecord[];
  primaryInvoice: InvoiceRecord | null;
  hasMultipleActive: boolean;
  hasOnlyCancelledOrDeleted: boolean;
};

/** 案件に紐づく請求書状態（削除・キャンセル除外して集計） */
export function getProjectInvoiceState(
  projectId: string,
  invoices: InvoiceRecord[],
  today: Date = new Date()
): ProjectInvoiceState {
  const activeInvoices = getActiveInvoicesForProject(invoices, projectId);
  const billableInvoices = activeInvoices.filter((inv) => inv.status !== "draft");

  const cancelledOrDeletedOnly =
    activeInvoices.length === 0 &&
    filterProjectInvoices(invoices, projectId, {
      includeCancelled: true,
      includeDeleted: false,
    }).some((inv) => isCanceledInvoice(inv));

  let invoiceStatus: InvoiceStatus = "not_created";
  if (billableInvoices.some((inv) => inv.status === "sent")) {
    invoiceStatus = "sent";
  } else if (
    billableInvoices.some(
      (inv) =>
        inv.status === "issued" ||
        inv.status === "overdue" ||
        inv.status === "paid"
    )
  ) {
    invoiceStatus = "issued";
  } else if (activeInvoices.some((inv) => inv.status === "draft")) {
    invoiceStatus = "draft";
  }

  let paymentStatus: ProjectPaymentStatus = "unpaid";
  if (billableInvoices.some((inv) => inv.status === "paid")) {
    paymentStatus = "paid";
  } else if (
    billableInvoices.some((inv) => isInvoiceOverdue(inv, today))
  ) {
    paymentStatus = "overdue";
  }

  return {
    invoiceStatus,
    paymentStatus,
    activeInvoices,
    billableInvoices,
    primaryInvoice: activeInvoices[0] ?? null,
    hasMultipleActive: activeInvoices.length > 1,
    hasOnlyCancelledOrDeleted: cancelledOrDeletedOnly,
  };
}

/** 請求書の増減・キャンセル・削除・期限変更後に案件の請求/入金状態を再計算 */
export function resolveProjectFieldsAfterInvoiceChange(
  projectId: string,
  invoices: InvoiceRecord[],
  options?: { excludeInvoiceId?: string; today?: Date }
): { invoiceStatus: InvoiceStatus; paymentStatus: ProjectPaymentStatus } {
  const scoped = invoices
    .filter((inv) => inv.projectId === projectId)
    .filter((inv) => !isDeletedInvoice(inv))
    .filter((inv) => inv.id !== options?.excludeInvoiceId);

  const state = getProjectInvoiceState(
    projectId,
    scoped,
    options?.today ?? new Date()
  );
  return {
    invoiceStatus: state.invoiceStatus,
    paymentStatus: state.paymentStatus,
  };
}
