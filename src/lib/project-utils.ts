import type {
  InvoiceStatus,
  ProjectActionType,
  ProjectPaymentStatus,
  ProjectStatus,
} from "@/lib/types";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";

export function normalizeProjectStatus(
  status: string | ProjectStatus
): ProjectStatus {
  switch (status) {
    case "estimate_before":
    case "estimate_sent":
    case "under_review":
      return "estimate";
    case "ordered":
    case "in_progress":
    case "completed":
    case "lost":
      return status as ProjectStatus;
    case "invoiced":
    case "paid":
      return "completed";
    default:
      return "estimate";
  }
}

export function getNextAction(args: {
  status: ProjectStatus;
  invoiceStatus: InvoiceStatus;
  paymentStatus: ProjectPaymentStatus;
}): string {
  const { status, invoiceStatus, paymentStatus } = args;

  if (status === "estimate") return "受注確定";
  if (status === "ordered") return "作業完了";
  if (status === "in_progress") return "作業完了";
  if (status === "lost") return "対応不要";

  // completed
  if (invoiceStatus === "not_created" || invoiceStatus === "draft") {
    return "請求書発行";
  }
  if (paymentStatus === "unpaid" || paymentStatus === "overdue") {
    return "入金確認";
  }
  return "完了";
}

export function getDefaultInvoiceStatus(
  status: ProjectStatus
): InvoiceStatus {
  if (status === "completed") return "not_created";
  return "not_created";
}

export function getDefaultPaymentStatus(
  status: ProjectStatus,
  dueDate: string
): ProjectPaymentStatus {
  void dueDate;
  return "unpaid";
}

// isOverdue は ProjectStatus 簡略化で未使用になったため削除

export type ProjectQuickAction = {
  type: ProjectActionType;
  label: string;
};

export function getQuickActions(
  args: {
    status: ProjectStatus;
    invoiceStatus: InvoiceStatus;
    paymentStatus: ProjectPaymentStatus;
  }
): ProjectQuickAction[] {
  const { status, invoiceStatus, paymentStatus } = args;

  if (status === "estimate") {
    return [{ type: "mark_ordered", label: "受注確定" }];
  }

  if (status === "ordered" || status === "in_progress") {
    return [{ type: "mark_completed", label: "作業完了" }];
  }

  if (status === "completed") {
    if (invoiceStatus === "not_created" || invoiceStatus === "draft") {
      return [{ type: "generate_invoice", label: "請求書を発行" }];
    }
    if (paymentStatus === "unpaid" || paymentStatus === "overdue") {
      return [{ type: "mark_paid", label: "入金済みにする" }];
    }
    return [];
  }

  return [];
}

export function getStatusAfterAction(
  action: ProjectActionType
): ProjectStatus | null {
  const map: Record<ProjectActionType, ProjectStatus> = {
    mark_ordered: "ordered",
    mark_in_progress: "in_progress",
    mark_completed: "completed",
    generate_invoice: "completed",
    mark_paid: "completed",
  };
  return map[action] ?? null;
}

export function getStatusChangeMessage(
  status: ProjectStatus,
  action?: ProjectActionType
): string {
  if (action === "generate_invoice") {
    return "請求書の作成画面を開きます";
  }
  return `案件を「${PROJECT_STATUS_LABELS[status]}」に変更しました`;
}

export const PROJECT_STATUS_OPTIONS: Array<{
  value: ProjectStatus;
  label: string;
}> = [
  { value: "estimate", label: "見積中" },
  { value: "ordered", label: "受注" },
  { value: "in_progress", label: "作業中" },
  { value: "completed", label: "完了" },
  { value: "lost", label: "失注" },
];
