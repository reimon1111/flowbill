/** 請求書支払期限の指定方式（null = 既存データ・mode未設定） */
export type InvoiceDueDateMode = "discussion" | "date";

export const INVOICE_DUE_DATE_DISCUSSION_LABEL = "別途打ち合わせによる";

export function normalizeInvoiceDueDateMode(
  value: string | null | undefined
): InvoiceDueDateMode | null {
  if (value === "discussion" || value === "date") return value;
  return null;
}

/**
 * 帳票ヘッダ用の支払期限表示。
 * - discussion → 「別途打ち合わせによる」
 * - date → formatDate(dueDate)
 * - mode未設定（既存）→ dueDate があれば日付、なければ非表示（discussionにしない）
 */
export function resolveInvoiceDueDateDisplay(
  invoice: {
    dueDateMode: InvoiceDueDateMode | null;
    dueDate: string;
  },
  formatDateFn: (iso: string) => string
): string | null {
  if (invoice.dueDateMode === "discussion") {
    return INVOICE_DUE_DATE_DISCUSSION_LABEL;
  }
  if (invoice.dueDateMode === "date") {
    const d = invoice.dueDate?.trim();
    return d ? formatDateFn(d) : null;
  }
  const legacy = invoice.dueDate?.trim();
  return legacy ? formatDateFn(legacy) : null;
}
