import type { ProjectStatus, QuoteStatus } from "@/lib/types";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";

export const PROJECT_CUSTOMER_LOCKED_AFTER_CONFIRM =
  "案件確定後は顧客を変更できません";
export const PROJECT_CUSTOMER_LOCKED_LOST =
  "失注済みの案件では顧客を変更できません";
export const PROJECT_CUSTOMER_LOCKED_NON_DRAFT_QUOTES =
  "提出・処理済みの見積書があるため、顧客を変更できません";
export const PROJECT_CUSTOMER_LOCKED_NON_DRAFT_COMMERCIAL =
  "発行済みの帳票があるため、顧客を変更できません";

/** 後方互換: 確定後メッセージ（従来定数名） */
export const PROJECT_CUSTOMER_LOCKED_MESSAGE =
  PROJECT_CUSTOMER_LOCKED_AFTER_CONFIRM;

/** 請求書: draft のみ顧客再割当可 */
export function isInvoiceCustomerReassignable(status: string): boolean {
  return status === "draft";
}

/** 注文書・納品書・領収書: draft のみ */
export function isCommercialDocumentCustomerReassignable(
  status: string
): boolean {
  return status === "draft";
}

export function isQuoteStatusAllowingCustomerChange(
  status: QuoteStatus | string
): boolean {
  return status === "draft";
}

/**
 * 案件の顧客変更可否と拒否理由を store 状態から判定。
 * 優先順: 失注 → 案件status → 非draft見積 → 非draft商業帳票
 */
export function getProjectCustomerChangeBlockReason(
  projectId: string
): string | null {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return "案件が見つかりません";

  const status = project.status as ProjectStatus;
  if (status === "lost") return PROJECT_CUSTOMER_LOCKED_LOST;
  if (status !== "estimate") return PROJECT_CUSTOMER_LOCKED_AFTER_CONFIRM;

  const quotes = useQuoteStore.getState().getQuotesByProjectId(projectId);
  if (quotes.some((q) => !isQuoteStatusAllowingCustomerChange(q.status))) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_QUOTES;
  }

  const orders = useOrderStore.getState().getOrdersByProjectId(projectId);
  if (
    orders.some(
      (o) =>
        !o.deletedAt && !isCommercialDocumentCustomerReassignable(o.status)
    )
  ) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_COMMERCIAL;
  }

  const deliveryNotes = useDeliveryNoteStore
    .getState()
    .getByProjectId(projectId);
  if (
    deliveryNotes.some(
      (d) =>
        !d.deletedAt && !isCommercialDocumentCustomerReassignable(d.status)
    )
  ) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_COMMERCIAL;
  }

  const invoices = useInvoiceStore
    .getState()
    .invoices.filter((inv) => inv.projectId === projectId && !inv.deletedAt);
  if (invoices.some((inv) => !isInvoiceCustomerReassignable(inv.status))) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_COMMERCIAL;
  }

  const receipts = useReceiptStore.getState().getByProjectId(projectId);
  if (
    receipts.some(
      (r) =>
        !r.deletedAt && !isCommercialDocumentCustomerReassignable(r.status)
    )
  ) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_COMMERCIAL;
  }

  return null;
}

export function canChangeProjectCustomer(projectId: string): boolean {
  return getProjectCustomerChangeBlockReason(projectId) === null;
}

/**
 * @deprecated status のみでは不十分。canChangeProjectCustomer(projectId) を使う。
 * 互換のため status===estimate のとき true（最終判定はブロック理由を使うこと）。
 */
export function canChangeProjectCustomerByStatus(
  status: ProjectStatus | string | null | undefined
): boolean {
  return status === "estimate";
}

export function projectCustomerChangeLockedReason(
  projectId: string
): string | null {
  return getProjectCustomerChangeBlockReason(projectId);
}

/** RPC / Supabase エラー文言 → ユーザー向けメッセージ */
export function mapCustomerChangeRpcError(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("blocked: lost") || m.includes("project customer change blocked: lost")) {
    return PROJECT_CUSTOMER_LOCKED_LOST;
  }
  if (
    m.includes("non-draft quotes") ||
    m.includes("project customer change blocked: non-draft quotes")
  ) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_QUOTES;
  }
  if (
    m.includes("non-draft commercial") ||
    m.includes("project customer change blocked: non-draft commercial")
  ) {
    return PROJECT_CUSTOMER_LOCKED_NON_DRAFT_COMMERCIAL;
  }
  if (
    m.includes("project customer change is locked") ||
    m.includes("locked after confirmation")
  ) {
    return PROJECT_CUSTOMER_LOCKED_AFTER_CONFIRM;
  }
  return null;
}
