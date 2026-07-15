import { pickCounterpartyContact } from "@/lib/counterparty-contact";
import {
  itemsFromInvoiceItems,
} from "@/lib/build-commercial-items";
import { todayISO } from "@/lib/quote-dates";
import { resolveCommercialItemsForProject } from "@/lib/services/project-items";
import {
  getSelectableQuotesForProject,
  pickPreferredQuoteForOrder,
} from "@/lib/order-create-source";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toUserFacingDbError } from "@/lib/db/errors";
import {
  dbInsertDeliveryNote,
  dbInsertOrder,
  dbInsertReceipt,
  dbUpdateDeliveryNote,
  dbUpdateOrder,
  dbUpdateReceipt,
  dbSoftDeleteDeliveryNote,
  dbSoftDeleteOrder,
  dbSoftDeleteReceipt,
} from "@/lib/db/write-commercial-documents";
import type {
  DeliveryNoteInput,
  DeliveryNoteItemRecord,
  DeliveryNoteRecord,
  OrderInput,
  OrderItemRecord,
  OrderRecord,
  ReceiptInput,
  ReceiptItemRecord,
  ReceiptRecord,
} from "@/lib/commercial-document";
import type { CommercialDocumentFormValues, OrderDocumentFormValues } from "@/lib/validations/commercial-document";
import type { QuoteRecord } from "@/lib/types";
import { normalizeUnit } from "@/lib/constants/units";
import { defaultOrderRecipientName } from "@/lib/order-recipient";
import { assertCanWriteBusinessData } from "@/lib/guards/write-access";

function defaultPaymentTerms(): string {
  return (
    useCompanySettingsStore.getState().settings.paymentTerms?.trim() ||
    "請求書発行後14日以内"
  );
}

export type CreateOrderFromProjectOptions = {
  /**
   * 使用する見積 ID。
   * null = 見積を使わず案件から作成。
   * undefined = 承認 → 提出済み → 下書きの自動優先（受注確定など）。
   */
  quoteId?: string | null;
};

function resolveQuoteForOrder(
  projectId: string,
  quoteId: string | null | undefined
): QuoteRecord | null {
  const selectable = getSelectableQuotesForProject(projectId);

  if (quoteId === null) return null;

  if (typeof quoteId === "string") {
    const selected = selectable.find((q) => q.id === quoteId) ?? null;
    if (!selected) {
      throw new Error("指定された見積書を利用できません");
    }
    return selected;
  }

  return pickPreferredQuoteForOrder(selectable);
}

export async function createOrderFromProject(
  projectId: string,
  options?: CreateOrderFromProjectOptions
) {
  assertCanWriteBusinessData();
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return null;

  const quote = resolveQuoteForOrder(projectId, options?.quoteId);
  const settings = useCompanySettingsStore.getState().settings;
  const templateMemo = settings.orderMemoTemplate ?? "";
  const sourceMemo = quote?.memo?.trim()
    ? quote.memo
    : project.memo?.trim()
      ? project.memo
      : templateMemo;

  const input: OrderInput = {
    projectId: project.id,
    customerId: project.customerId,
    quoteId: quote?.id ?? "",
    issueDate: todayISO(),
    paymentTerms: quote?.paymentTerms?.trim() || defaultPaymentTerms(),
    memo: sourceMemo,
    recipientName: defaultOrderRecipientName(settings.companyName),
    discountLabel: quote?.discountLabel ?? project.discountLabel ?? "",
    discountAmount: quote?.discountAmount ?? project.discountAmount ?? 0,
    ...pickCounterpartyContact(
      (quote?.customerContactName?.trim() ||
        quote?.customerDepartment?.trim() ||
        quote?.customerPosition?.trim())
        ? quote
        : project
    ),
    items: resolveCommercialItemsForProject(projectId, project.projectName, {
      quoteId: quote ? quote.id : options?.quoteId === null ? null : undefined,
    }),
  };

  const order = useOrderStore.getState().createOrder(input);
  if (isSupabaseConfigured()) {
    const items = useOrderStore.getState().getOrderItems(order.id);
    try {
      await dbInsertOrder(order, items);
    } catch (error) {
      useOrderStore.getState().removeOrder(order.id);
      throw toUserFacingDbError(error);
    }
  }
  return order;
}

/** 見積詳細から注文書を作成（見積内容をスナップショット） */
export async function createOrderFromQuote(quoteId: string) {
  const quote = useQuoteStore.getState().getQuoteById(quoteId);
  if (!quote || quote.status === "rejected") {
    throw new Error("指定された見積書を利用できません");
  }
  return createOrderFromProject(quote.projectId, { quoteId: quote.id });
}

export async function createDeliveryNoteFromProject(projectId: string) {
  assertCanWriteBusinessData();
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return null;

  const order = useOrderStore
    .getState()
    .getOrdersByProjectId(projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  const settings = useCompanySettingsStore.getState().settings;
  const input: DeliveryNoteInput = {
    projectId: project.id,
    customerId: project.customerId,
    orderId: order?.id ?? "",
    issueDate: todayISO(),
    paymentTerms: defaultPaymentTerms(),
    memo: settings.deliveryNoteMemoTemplate ?? "",
    discountLabel: order?.discountLabel ?? project.discountLabel ?? "",
    discountAmount: order?.discountAmount ?? project.discountAmount ?? 0,
    ...pickCounterpartyContact(
      (order?.customerContactName?.trim() || order?.customerDepartment?.trim() || order?.customerPosition?.trim())
        ? order
        : project
    ),
    items: resolveCommercialItemsForProject(projectId, project.projectName),
  };

  const note = useDeliveryNoteStore.getState().createDeliveryNote(input);
  if (isSupabaseConfigured()) {
    const items = useDeliveryNoteStore.getState().getItems(note.id);
    await dbInsertDeliveryNote(note, items);
  }
  return note;
}

export async function createReceiptFromInvoice(invoiceId: string) {
  assertCanWriteBusinessData();
  const invoice = useInvoiceStore.getState().getInvoiceById(invoiceId);
  if (!invoice) return null;

  const invoiceItems = useInvoiceStore.getState().getInvoiceItems(invoiceId);
  const settings = useCompanySettingsStore.getState().settings;

  const input: ReceiptInput = {
    projectId: invoice.projectId,
    customerId: invoice.customerId,
    invoiceId: invoice.id,
    issueDate: todayISO(),
    paymentTerms: invoice.paymentTerms || defaultPaymentTerms(),
    memo: settings.receiptMemoTemplate ?? "",
    discountLabel: invoice.discountLabel ?? "",
    discountAmount: invoice.discountAmount ?? 0,
    ...pickCounterpartyContact(invoice),
    items: itemsFromInvoiceItems(invoiceItems),
  };

  const receipt = useReceiptStore.getState().createReceipt(input);
  if (isSupabaseConfigured()) {
    const items = useReceiptStore.getState().getItems(receipt.id);
    await dbInsertReceipt(receipt, items);
  }
  return receipt;
}

export async function createReceiptFromProject(projectId: string) {
  assertCanWriteBusinessData();
  const invoice = useInvoiceStore
    .getState()
    .getInvoicesByProjectId(projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!invoice) return null;
  return createReceiptFromInvoice(invoice.id);
}

export function getOrderById(id: string): OrderRecord | null {
  return useOrderStore.getState().getOrderById(id) ?? null;
}

export function getOrderItems(orderId: string): OrderItemRecord[] {
  return useOrderStore.getState().getOrderItems(orderId);
}

export function getDeliveryNoteById(id: string): DeliveryNoteRecord | null {
  return useDeliveryNoteStore.getState().getDeliveryNoteById(id) ?? null;
}

export function getDeliveryNoteItems(deliveryNoteId: string): DeliveryNoteItemRecord[] {
  return useDeliveryNoteStore.getState().getItems(deliveryNoteId);
}

export function getReceiptById(id: string): ReceiptRecord | null {
  return useReceiptStore.getState().getReceiptById(id) ?? null;
}

export function getReceiptItems(receiptId: string): ReceiptItemRecord[] {
  return useReceiptStore.getState().getItems(receiptId);
}

export function commercialDocumentInputFromForm(
  values: CommercialDocumentFormValues
): OrderInput {
  return {
    projectId: values.projectId,
    customerId: values.customerId,
    issueDate: values.issueDate,
    paymentTerms: values.paymentTerms.trim(),
    memo: values.memo.trim(),
    discountLabel: values.discountLabel.trim(),
    discountAmount: values.discountAmount ?? 0,
    customerContactName: values.customerContactName.trim(),
    customerDepartment: values.customerDepartment.trim(),
    customerPosition: values.customerPosition.trim(),
    items: values.items.map((it, idx) => ({
      itemTemplateId: it.itemTemplateId,
      name: it.name.trim(),
      description: it.description.trim(),
      width: it.width?.trim() ?? "",
      height: it.height?.trim() ?? "",
      quantity: it.quantity,
      unit: normalizeUnit(it.unit),
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      sortOrder: it.sortOrder ?? idx,
    })),
  };
}

export function orderInputFromForm(values: OrderDocumentFormValues): OrderInput {
  return {
    ...commercialDocumentInputFromForm(values),
    recipientName: values.recipientName.trim(),
  };
}

export async function updateOrder(
  id: string,
  input: OrderInput
): Promise<OrderRecord | null> {
  assertCanWriteBusinessData();
  const updated = useOrderStore.getState().updateOrder(id, input);
  if (!updated) return null;

  if (isSupabaseConfigured()) {
    try {
      await dbUpdateOrder(updated, useOrderStore.getState().getOrderItems(id));
    } catch (error) {
      throw toUserFacingDbError(error);
    }
  }
  return updated;
}

export async function updateDeliveryNote(
  id: string,
  input: DeliveryNoteInput
): Promise<DeliveryNoteRecord | null> {
  assertCanWriteBusinessData();
  const updated = useDeliveryNoteStore.getState().updateDeliveryNote(id, input);
  if (!updated) return null;

  if (isSupabaseConfigured()) {
    try {
      await dbUpdateDeliveryNote(
        updated,
        useDeliveryNoteStore.getState().getItems(id)
      );
    } catch (error) {
      throw toUserFacingDbError(error);
    }
  }
  return updated;
}

export async function updateReceipt(
  id: string,
  input: ReceiptInput
): Promise<ReceiptRecord | null> {
  assertCanWriteBusinessData();
  const updated = useReceiptStore.getState().updateReceipt(id, input);
  if (!updated) return null;

  if (isSupabaseConfigured()) {
    try {
      await dbUpdateReceipt(updated, useReceiptStore.getState().getItems(id));
    } catch (error) {
      throw toUserFacingDbError(error);
    }
  }
  return updated;
}

/** 案件に注文書がなければ作成（受注確定時） */
export async function ensureOrderForProject(projectId: string) {
  const existing = useOrderStore
    .getState()
    .getOrdersByProjectId(projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (existing) return existing;
  return createOrderFromProject(projectId);
}

/** 案件に納品書がなければ作成（作業完了時） */
export async function ensureDeliveryNoteForProject(projectId: string) {
  const existing = useDeliveryNoteStore
    .getState()
    .getByProjectId(projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (existing) return existing;
  return createDeliveryNoteFromProject(projectId);
}

/** 請求書に紐づく領収書がなければ作成（請求書発行時） */
export async function ensureReceiptForInvoice(invoiceId: string) {
  const existing = useReceiptStore
    .getState()
    .receipts.filter((r) => r.invoiceId === invoiceId && !r.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (existing) return existing;
  return createReceiptFromInvoice(invoiceId);
}

export async function deleteOrder(
  id: string
): Promise<{ ok: true } | { ok: false }> {
  assertCanWriteBusinessData();
  const order = useOrderStore.getState().getOrderById(id);
  if (!order || order.deletedAt) return { ok: false };

  const updated = useOrderStore.getState().softDeleteOrder(id);
  if (!updated) return { ok: false };

  if (isSupabaseConfigured()) {
    try {
      await dbSoftDeleteOrder(id);
    } catch (error) {
      throw toUserFacingDbError(error);
    }
  }
  return { ok: true };
}

export async function deleteDeliveryNote(
  id: string
): Promise<{ ok: true } | { ok: false }> {
  assertCanWriteBusinessData();
  const note = useDeliveryNoteStore.getState().getDeliveryNoteById(id);
  if (!note || note.deletedAt) return { ok: false };

  const updated = useDeliveryNoteStore.getState().softDeleteDeliveryNote(id);
  if (!updated) return { ok: false };

  if (isSupabaseConfigured()) {
    try {
      await dbSoftDeleteDeliveryNote(id);
    } catch (error) {
      throw toUserFacingDbError(error);
    }
  }
  return { ok: true };
}

export async function deleteReceipt(
  id: string
): Promise<{ ok: true } | { ok: false }> {
  assertCanWriteBusinessData();
  const receipt = useReceiptStore.getState().getReceiptById(id);
  if (!receipt || receipt.deletedAt) return { ok: false };

  const updated = useReceiptStore.getState().softDeleteReceipt(id);
  if (!updated) return { ok: false };

  if (isSupabaseConfigured()) {
    try {
      await dbSoftDeleteReceipt(id);
    } catch (error) {
      throw toUserFacingDbError(error);
    }
  }
  return { ok: true };
}
