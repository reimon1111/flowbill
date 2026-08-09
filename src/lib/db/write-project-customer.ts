import type { Customer, ProjectRecord } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { getAuthUserId } from "@/lib/db/auth-user";
import {
  isMissingRpcFunction,
  logSupabaseError,
} from "@/lib/db/errors";
import {
  getProjectCustomerChangeBlockReason,
  isCommercialDocumentCustomerReassignable,
  isInvoiceCustomerReassignable,
  mapCustomerChangeRpcError,
  PROJECT_CUSTOMER_LOCKED_AFTER_CONFIRM,
} from "@/lib/project-customer";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";
import { useCustomerStore } from "@/stores/customer-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const PROJECT_CUSTOMER_LOCKED_MESSAGE =
  PROJECT_CUSTOMER_LOCKED_AFTER_CONFIRM;

export const REASSIGN_PROJECT_CUSTOMER_RPC_HINT =
  "未確定案件の顧客変更処理（reassign_estimate_project_customer）が未適用または旧版です。supabase/update-quote-customer-reassign-atomic.sql を実行してください。";

/**
 * 顧客再割当の結果をクライアントストアへ反映（DB成功後 or ローカルモード）。
 */
export function applyCustomerChangeToStores(
  projectId: string,
  newCustomerId: string,
  customer: Customer
) {
  const contact = customer.contactName?.trim() ?? "";
  const now = new Date().toISOString();

  const projectStore = useProjectStore.getState();
  const project = projectStore.getProjectById(projectId);
  if (project) {
    projectStore.hydrate({
      projects: projectStore.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              customerId: newCustomerId,
              customerContactName: contact,
              customerDepartment: "",
              customerPosition: "",
              updatedAt: now,
            }
          : p
      ),
      histories: projectStore.histories,
    });
  }

  const quoteStore = useQuoteStore.getState();
  quoteStore.hydrate({
    quotes: quoteStore.quotes.map((q) =>
      q.projectId === projectId
        ? {
            ...q,
            customerId: newCustomerId,
            customerContactName: contact,
            customerDepartment: "",
            customerPosition: "",
            updatedAt: now,
          }
        : q
    ),
    quoteItems: quoteStore.quoteItems,
  });

  const invoiceStore = useInvoiceStore.getState();
  invoiceStore.hydrate({
    invoices: invoiceStore.invoices.map((inv) =>
      inv.projectId === projectId &&
      isInvoiceCustomerReassignable(inv.status) &&
      !inv.deletedAt
        ? {
            ...inv,
            customerId: newCustomerId,
            customerContactName: contact,
            customerDepartment: "",
            customerPosition: "",
            updatedAt: now,
          }
        : inv
    ),
    invoiceItems: invoiceStore.invoiceItems,
  });

  const orderStore = useOrderStore.getState();
  orderStore.hydrate({
    orders: orderStore.orders.map((o) =>
      o.projectId === projectId &&
      isCommercialDocumentCustomerReassignable(o.status) &&
      !o.deletedAt
        ? {
            ...o,
            customerId: newCustomerId,
            customerContactName: contact,
            customerDepartment: "",
            customerPosition: "",
            updatedAt: now,
          }
        : o
    ),
    orderItems: orderStore.orderItems,
  });

  const deliveryStore = useDeliveryNoteStore.getState();
  deliveryStore.hydrate({
    deliveryNotes: deliveryStore.deliveryNotes.map((d) =>
      d.projectId === projectId &&
      isCommercialDocumentCustomerReassignable(d.status) &&
      !d.deletedAt
        ? {
            ...d,
            customerId: newCustomerId,
            customerContactName: contact,
            customerDepartment: "",
            customerPosition: "",
            updatedAt: now,
          }
        : d
    ),
    deliveryNoteItems: deliveryStore.deliveryNoteItems,
  });

  const receiptStore = useReceiptStore.getState();
  receiptStore.hydrate({
    receipts: receiptStore.receipts.map((r) =>
      r.projectId === projectId &&
      isCommercialDocumentCustomerReassignable(r.status) &&
      !r.deletedAt
        ? {
            ...r,
            customerId: newCustomerId,
            customerContactName: contact,
            customerDepartment: "",
            customerPosition: "",
            updatedAt: now,
          }
        : r
    ),
    receiptItems: receiptStore.receiptItems,
  });
}

/**
 * ローカルモード用: 顧客再割当のみ（ストア）。
 * Supabase モードでは見積保存 RPC 内で原子的に行うため、通常は呼ばない。
 */
export function reassignEstimateProjectCustomerLocal(
  projectId: string,
  newCustomerId: string
): void {
  const block = getProjectCustomerChangeBlockReason(projectId);
  if (block) throw new Error(block);

  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) throw new Error("案件が見つかりません");
  if (project.customerId === newCustomerId) return;

  const customer = useCustomerStore.getState().getCustomerById(newCustomerId);
  if (!customer) throw new Error("顧客が見つかりません");

  applyCustomerChangeToStores(projectId, newCustomerId, customer);
}

/** @deprecated 単独 customer reassign RPC。見積保存時は update_quote_with_items を使う */
export async function reassignEstimateProjectCustomer(
  projectId: string,
  newCustomerId: string
): Promise<void> {
  const block = getProjectCustomerChangeBlockReason(projectId);
  if (block) throw new Error(block);

  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) throw new Error("案件が見つかりません");
  if (project.customerId === newCustomerId) return;

  const customer = useCustomerStore.getState().getCustomerById(newCustomerId);
  if (!customer) throw new Error("顧客が見つかりません");

  if (isSupabaseConfigured()) {
    await dbReassignEstimateProjectCustomer(projectId, newCustomerId);
  }

  applyCustomerChangeToStores(projectId, newCustomerId, customer);
}

async function dbReassignEstimateProjectCustomer(
  projectId: string,
  newCustomerId: string
): Promise<void> {
  await resolveCompanyId();
  await getAuthUserId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc(
    "reassign_estimate_project_customer",
    {
      p_project_id: projectId,
      p_new_customer_id: newCustomerId,
    }
  );

  if (error) {
    if (isMissingRpcFunction(error, "reassign_estimate_project_customer")) {
      logSupabaseError("reassign_estimate_project_customer missing", error);
      throw new Error(REASSIGN_PROJECT_CUSTOMER_RPC_HINT);
    }
    const message = String((error as { message?: string }).message ?? "");
    const mapped = mapCustomerChangeRpcError(message);
    if (mapped) throw new Error(mapped);
    if (message.toLowerCase().includes("project not found")) {
      throw new Error("案件が見つかりません");
    }
    if (message.toLowerCase().includes("customer not found")) {
      throw new Error("顧客が見つかりません");
    }
    throw error;
  }

  if (data && typeof data === "object" && "error" in (data as object)) {
    throw new Error("顧客変更に失敗しました");
  }
}

export function assertProjectAllowsCustomerChange(
  project: ProjectRecord | null | undefined
): void {
  if (!project) throw new Error("案件が見つかりません");
  const block = getProjectCustomerChangeBlockReason(project.id);
  if (block) throw new Error(block);
}
