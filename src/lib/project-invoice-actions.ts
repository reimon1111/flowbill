import type { InvoiceRecord, ProjectActionType, ProjectStatus } from "@/lib/types";
import {
  getBillingStatusTheme,
  getProjectBillingDisplayStatus,
} from "@/lib/billing-status-theme";
import {
  getActiveInvoicesForProject,
  getPrimaryProjectInvoice,
  filterProjectInvoices,
} from "@/lib/invoice-filters";
import { getProjectInvoiceState } from "@/lib/invoice-state";

export type ProjectInvoiceNavigation =
  | { type: "new" }
  | { type: "additional" }
  | { type: "existing"; invoiceId: string };

/** 請求書発行ボタン押下時の遷移先（DBには書き込まない） */
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
};

/** 案件詳細「次にやること」用の請求アクション */
export function getProjectInvoiceQuickAction(args: {
  status: ProjectStatus;
  invoices: InvoiceRecord[];
  projectId: string;
}): ProjectInvoiceQuickAction | null {
  const { status, invoices, projectId } = args;
  if (status !== "completed") return null;

  const state = getProjectInvoiceState(projectId, invoices);
  const billingStatus = getProjectBillingDisplayStatus(state, status);
  if (!billingStatus) return null;

  const theme = getBillingStatusTheme(billingStatus);

  if (billingStatus === "unissued") {
    return { type: "generate_invoice", label: theme.actionLabel };
  }

  if (
    billingStatus === "unpaid" ||
    billingStatus === "overdue" ||
    billingStatus === "paid" ||
    billingStatus === "multiple"
  ) {
    return { type: "view_invoice", label: theme.actionLabel };
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
