import type { InvoiceRecord, ProjectActionType, ProjectStatus } from "@/lib/types";
import {
  getBillingStatusTheme,
  getProjectBillingDisplayStatus,
  type BillingDisplayStatus,
} from "@/lib/billing-status-theme";
import {
  getActiveInvoicesForProject,
  getPrimaryProjectInvoice,
  filterProjectInvoices,
} from "@/lib/invoice-filters";
import { getProjectInvoiceState } from "@/lib/invoice-state";
import { canCreateInvoice } from "@/lib/document-creation-policy";
import type { WorkflowMode } from "@/lib/workflow-mode";

export type ProjectInvoiceNavigation =
  | { type: "new" }
  | { type: "additional" }
  | { type: "existing"; invoiceId: string };

/** 請求アクション押下時の遷移先（DBには書き込まない） */
export function resolveProjectInvoiceNavigation(
  invoices: InvoiceRecord[],
  projectId: string,
  options?: { allowAdditional?: boolean }
): ProjectInvoiceNavigation {
  const primary = getPrimaryProjectInvoice(invoices, projectId);
  if (primary) {
    if (options?.allowAdditional) {
      return { type: "additional" };
    }
    return { type: "existing", invoiceId: primary.id };
  }
  return { type: "new" };
}

export function buildProjectInvoiceHref(
  projectId: string,
  nav: ProjectInvoiceNavigation
): string {
  if (nav.type === "existing") {
    return `/invoices/${nav.invoiceId}`;
  }
  if (nav.type === "additional") {
    return `/invoices/new?projectId=${projectId}&additional=1`;
  }
  return `/invoices/new?projectId=${projectId}`;
}

export type ProjectInvoiceQuickAction = {
  type: ProjectActionType;
  label: string;
  billingStatus: BillingDisplayStatus;
};

/**
 * 案件の請求表示ステータス（完了以外でも draft / not_created を返す）。
 * UI 文言用。データ生成ロジックには影響しない。
 */
export function resolveInvoiceActionBillingStatus(args: {
  status: ProjectStatus;
  invoices: InvoiceRecord[];
  projectId: string;
}): BillingDisplayStatus | null {
  const { status, invoices, projectId } = args;
  const state = getProjectInvoiceState(projectId, invoices);

  if (state.hasMultipleActive) return "multiple";
  if (state.invoiceStatus === "draft") return "draft";
  if (
    state.invoiceStatus === "not_created" ||
    state.activeInvoices.length === 0
  ) {
    return "not_created";
  }

  const completedBilling = getProjectBillingDisplayStatus(state, status);
  if (completedBilling) return completedBilling;

  if (state.paymentStatus === "paid") return "paid";
  if (state.paymentStatus === "overdue") return "overdue";
  if (state.paymentStatus === "unpaid") return "unpaid";
  return null;
}

/** 案件詳細「次にやること」用の請求アクション */
export function getProjectInvoiceQuickAction(args: {
  status: ProjectStatus;
  invoices: InvoiceRecord[];
  projectId: string;
  workflowMode?: WorkflowMode | string | null;
}): ProjectInvoiceQuickAction | null {
  const { status, invoices, projectId, workflowMode } = args;
  const createAllowed = canCreateInvoice({
    workflowMode,
    projectStatus: status,
  }).allowed;

  const billingStatus = resolveInvoiceActionBillingStatus({
    status,
    invoices,
    projectId,
  });
  if (!billingStatus) return null;

  const theme = getBillingStatusTheme(billingStatus);

  if (billingStatus === "not_created") {
    if (!createAllowed) return null;
    return {
      type: "generate_invoice",
      label: theme.actionLabel,
      billingStatus,
    };
  }

  if (billingStatus === "draft") {
    return {
      type: "view_invoice",
      label: theme.actionLabel,
      billingStatus,
    };
  }

  if (
    billingStatus === "unpaid" ||
    billingStatus === "overdue" ||
    billingStatus === "paid" ||
    billingStatus === "multiple"
  ) {
    return {
      type: "view_invoice",
      label: theme.actionLabel,
      billingStatus,
    };
  }

  return null;
}

export function getProjectInvoiceTabState(args: {
  invoices: InvoiceRecord[];
  projectId: string;
  showCancelled: boolean;
}) {
  const { invoices, projectId, showCancelled } = args;
  const active = getActiveInvoicesForProject(invoices, projectId);
  const visible = filterProjectInvoices(invoices, projectId, {
    includeCancelled: showCancelled,
    includeDeleted: false,
  });
  const cancelledCount = filterProjectInvoices(invoices, projectId, {
    includeCancelled: true,
    includeDeleted: false,
  }).filter((inv) => inv.status === "cancelled").length;

  return {
    active,
    visible,
    primary: active[0] ?? null,
    hasMultipleActive: active.length > 1,
    hasOnlyCancelled:
      active.length === 0 &&
      filterProjectInvoices(invoices, projectId, {
        includeCancelled: true,
        includeDeleted: false,
      }).length > 0,
    cancelledCount,
  };
}
