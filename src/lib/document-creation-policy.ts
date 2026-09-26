import type { ProjectStatus } from "@/lib/types";
import {
  DEFAULT_WORKFLOW_MODE,
  type WorkflowMode,
  normalizeWorkflowMode,
} from "@/lib/workflow-mode";

export type DocumentCreationKind =
  | "quote"
  | "order"
  | "delivery_note"
  | "invoice"
  | "receipt";

export type DocumentCreationContext = {
  /** 案件にスナップショットされたモード（会社設定ではない） */
  workflowMode?: WorkflowMode | string | null;
  projectStatus: ProjectStatus | string;
  /** 領収書判定用。有効な請求があるか */
  hasInvoice?: boolean;
  /** simple 初期セットが完了しているか */
  simpleDocumentsInitialized?: boolean;
};

export type DocumentCreationDecision = {
  allowed: boolean;
  /** UI ヒント（不可時） */
  reason?: string;
};

function resolveMode(
  workflowMode: DocumentCreationContext["workflowMode"]
): WorkflowMode {
  return normalizeWorkflowMode(workflowMode ?? DEFAULT_WORKFLOW_MODE);
}

function isLost(status: string): boolean {
  return status === "lost";
}

const LOST_REASON = "失注案件では新規帳票を作成できません";

/**
 * 見積作成可否。
 * standard / simple とも lost 以外は可（追加見積含む）。
 */
export function canCreateQuote(
  ctx: DocumentCreationContext
): DocumentCreationDecision {
  if (isLost(ctx.projectStatus)) {
    return { allowed: false, reason: LOST_REASON };
  }
  return { allowed: true };
}

/**
 * 注文書作成可否。
 * standard: lost 以外
 * simple: 初期セット済みなら追加作成可（lost 以外）
 */
export function canCreateOrder(
  ctx: DocumentCreationContext
): DocumentCreationDecision {
  if (isLost(ctx.projectStatus)) {
    return { allowed: false, reason: LOST_REASON };
  }
  return { allowed: true };
}

/**
 * 納品書作成可否。
 * standard: completed のみ
 * simple: lost 以外（初期セット後の追加も可）
 */
export function canCreateDeliveryNote(
  ctx: DocumentCreationContext
): DocumentCreationDecision {
  if (isLost(ctx.projectStatus)) {
    return { allowed: false, reason: LOST_REASON };
  }
  const mode = resolveMode(ctx.workflowMode);
  if (mode === "simple") {
    return { allowed: true };
  }
  if (ctx.projectStatus === "completed") {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "作業完了後に作成できます",
  };
}

/**
 * 請求書作成可否。
 * standard: completed のみ
 * simple: lost 以外（追加請求含む）
 */
export function canCreateInvoice(
  ctx: DocumentCreationContext
): DocumentCreationDecision {
  if (isLost(ctx.projectStatus)) {
    return { allowed: false, reason: LOST_REASON };
  }
  const mode = resolveMode(ctx.workflowMode);
  if (mode === "simple") {
    return { allowed: true };
  }
  if (ctx.projectStatus === "completed") {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: "案件完了後に生成できます",
  };
}

/**
 * 領収書作成可否。
 * standard: 請求あり + lost 以外
 * simple: 初期セットで領収 draft はあるが、追加作成は請求あり必須
 */
export function canCreateReceipt(
  ctx: DocumentCreationContext
): DocumentCreationDecision {
  if (isLost(ctx.projectStatus)) {
    return { allowed: false, reason: LOST_REASON };
  }
  if (!ctx.hasInvoice) {
    return {
      allowed: false,
      reason: "請求書作成後に作成できます",
    };
  }
  return { allowed: true };
}

export function getDocumentCreationAvailability(
  ctx: DocumentCreationContext
): Record<DocumentCreationKind, DocumentCreationDecision> {
  return {
    quote: canCreateQuote(ctx),
    order: canCreateOrder(ctx),
    delivery_note: canCreateDeliveryNote(ctx),
    invoice: canCreateInvoice(ctx),
    receipt: canCreateReceipt(ctx),
  };
}

export function assertDocumentCreationAllowed(
  kind: DocumentCreationKind,
  ctx: DocumentCreationContext
): void {
  const decision = getDocumentCreationAvailability(ctx)[kind];
  if (!decision.allowed) {
    throw new Error(decision.reason ?? "この帳票は作成できません");
  }
}
