import type {
  DeliveryNoteItemRecord,
  DeliveryNoteRecord,
  OrderItemRecord,
  OrderRecord,
  ReceiptItemRecord,
  ReceiptRecord,
} from "@/lib/commercial-document";
import {
  buildCommercialHeader,
  buildCommercialItemRecords,
} from "@/lib/create-commercial-store";
import { allocateDocumentNumber } from "@/lib/document-number";
import { generateId } from "@/lib/db/ids";
import {
  buildInvoiceItems,
  buildQuoteItems,
  computeLineTotals,
  invoiceItemToRow,
  invoiceToRow,
  quoteItemToRow,
  quoteToRow,
} from "@/lib/db/mappers";
import {
  deliveryNoteItemToRow,
  deliveryNoteToRow,
  orderItemToRow,
  orderToRow,
  receiptItemToRow,
  receiptToRow,
} from "@/lib/db/commercial-mappers";
import { resolveCompanyId } from "@/lib/db/company-context";
import { getSupabaseClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { toUserFacingDbError } from "@/lib/db/errors";
import { composeInitialDocumentMemo } from "@/lib/document-memo";
import { DEFAULT_DOCUMENT_MEMO_FONT_SIZE } from "@/lib/document-memo-font-size";
import { pickCounterpartyContact } from "@/lib/counterparty-contact";
import { pickCustomerHonorific } from "@/lib/customer-honorific";
import { defaultOrderRecipientName } from "@/lib/order-recipient";
import { todayISO } from "@/lib/quote-dates";
import {
  DEFAULT_QUOTE_EXPIRY_TYPE,
  calculateQuoteExpiryDate,
} from "@/lib/quote-expiry";
import {
  buildQuoteInputItemsForProject,
  resolveCommercialItemsForProject,
} from "@/lib/services/project-items";
import { resolveInitialDocumentContactForCreate } from "@/lib/services/user-profile-settings";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useOrderStore } from "@/stores/order-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useReceiptStore } from "@/stores/receipt-store";
import type {
  InvoiceItemRecord,
  InvoiceRecord,
  QuoteItemRecord,
  QuoteRecord,
} from "@/lib/types";
import { isSimpleWorkflowMode } from "@/lib/workflow-mode";
import { reloadSingleProjectToStore } from "@/lib/db/load-all";

export type SimpleDocumentsProvisionResult = {
  alreadyInitialized: boolean;
  quoteId: string;
  orderId: string;
  deliveryNoteId: string;
  invoiceId: string;
  receiptId: string;
};

type BuiltSimpleDocuments = {
  quote: QuoteRecord;
  quoteItems: QuoteItemRecord[];
  order: OrderRecord;
  orderItems: OrderItemRecord[];
  deliveryNote: DeliveryNoteRecord;
  deliveryNoteItems: DeliveryNoteItemRecord[];
  invoice: InvoiceRecord;
  invoiceItems: InvoiceItemRecord[];
  receipt: ReceiptRecord;
  receiptItems: ReceiptItemRecord[];
};

async function buildSimpleDocuments(
  projectId: string
): Promise<BuiltSimpleDocuments> {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) throw new Error("案件が見つかりません");
  if (!isSimpleWorkflowMode(project.workflowMode)) {
    throw new Error("簡易モードの案件ではありません");
  }

  const settings = useCompanySettingsStore.getState().settings;
  const documentContact = await resolveInitialDocumentContactForCreate();
  const issueDate = todayISO();
  const now = new Date().toISOString();
  const expiryType =
    settings.quoteDefaultExpiryType ?? DEFAULT_QUOTE_EXPIRY_TYPE;
  const paymentTerms =
    settings.paymentTerms?.trim() || "請求書発行後14日以内";
  const contact = pickCounterpartyContact(project);
  const honorific = pickCustomerHonorific(project);

  const quoteNumber = await allocateDocumentNumber(
    "quote",
    issueDate,
    useQuoteStore.getState().getQuotes().map((q) => q.quoteNumber)
  );
  const orderNumber = await allocateDocumentNumber(
    "order",
    issueDate,
    useOrderStore.getState().orders.map((o) => o.orderNumber)
  );
  const deliveryNoteNumber = await allocateDocumentNumber(
    "delivery_note",
    issueDate,
    useDeliveryNoteStore.getState().deliveryNotes.map((d) => d.deliveryNoteNumber)
  );
  const invoiceNumber = await allocateDocumentNumber(
    "invoice",
    issueDate,
    useInvoiceStore.getState().invoices.map((i) => i.invoiceNumber)
  );
  const receiptNumber = await allocateDocumentNumber(
    "receipt",
    issueDate,
    useReceiptStore.getState().receipts.map((r) => r.receiptNumber)
  );
  const quoteItemInputs = buildQuoteInputItemsForProject(
    projectId,
    project.projectName,
    project.amount ?? 0
  );
  const resolvedQuoteItems =
    quoteItemInputs.length > 0
      ? quoteItemInputs
      : [
          {
            itemTemplateId: null as string | null,
            name: project.projectName || "工事一式",
            description: "",
            width: "",
            height: "",
            quantity: 1,
            unit: "式",
            unitPrice: project.amount ?? 0,
            taxRate: 0.1 as const,
            sortOrder: 0,
          },
        ];

  const quoteId = generateId("qt_");
  const quoteItems = buildQuoteItems(
    "local",
    quoteId,
    {
      projectId,
      customerId: project.customerId,
      issueDate,
      expiryType,
      expiryDate: calculateQuoteExpiryDate(issueDate, expiryType),
      paymentTerms,
      memo: composeInitialDocumentMemo(
        project.documentMemo,
        settings.quoteMemoTemplate
      ),
      documentEmail: documentContact.email,
      documentContactName: documentContact.contactName,
      discountLabel: project.discountLabel ?? "",
      discountAmount: project.discountAmount ?? 0,
      customerHonorific: honorific,
      ...contact,
      memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
      items: resolvedQuoteItems,
    },
    now
  ).map((it) => ({ ...it, id: generateId("qti_") }));
  const quoteTotals = computeLineTotals(quoteItems, {
    discountLabel: project.discountLabel ?? "",
    discountAmount: project.discountAmount ?? 0,
  });
  const quote: QuoteRecord = {
    id: quoteId,
    projectId,
    customerId: project.customerId,
    quoteNumber,
    issueDate,
    expiryType,
    expiryDate: calculateQuoteExpiryDate(issueDate, expiryType),
    status: "draft",
    subtotal: quoteTotals.subtotal,
    taxAmount: quoteTotals.taxAmount,
    totalAmount: quoteTotals.totalAmount,
    discountLabel: project.discountLabel ?? "",
    discountAmount: project.discountAmount ?? 0,
    customerHonorific: honorific,
    ...contact,
    memo: composeInitialDocumentMemo(
      project.documentMemo,
      settings.quoteMemoTemplate
    ),
    memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
    documentEmail: documentContact.email,
    documentContactName: documentContact.contactName,
    paymentTerms,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  // 一時的に見積を store へ載せて commercial items 解決に使えるようにする
  useQuoteStore.getState().mergeQuote(quote, quoteItems);

  const commercialItems = resolveCommercialItemsForProject(
    projectId,
    project.projectName,
    { quoteId: quote.id }
  );

  const orderId = generateId("ord_");
  const orderItems = buildCommercialItemRecords<OrderItemRecord>(
    orderId,
    "orderId",
    commercialItems,
    "oi_"
  );
  const orderHeader = buildCommercialHeader(
    {
      projectId,
      customerId: project.customerId,
      issueDate,
      paymentTerms,
      memo: composeInitialDocumentMemo(
        project.documentMemo,
        settings.orderMemoTemplate
      ),
      documentEmail: documentContact.email,
      documentContactName: documentContact.contactName,
      discountLabel: project.discountLabel ?? "",
      discountAmount: project.discountAmount ?? 0,
      ...contact,
      memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
    },
    commercialItems
  );
  const { customerHonorific: _h, ...orderHeaderRest } = orderHeader;
  void _h;
  const order: OrderRecord = {
    id: orderId,
    quoteId: quote.id,
    orderNumber,
    status: "draft",
    recipientName: defaultOrderRecipientName(settings.companyName),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...orderHeaderRest,
  };

  const deliveryNoteId = generateId("dn_");
  const deliveryNoteItems = buildCommercialItemRecords<DeliveryNoteItemRecord>(
    deliveryNoteId,
    "deliveryNoteId",
    commercialItems,
    "dni_"
  );
  const deliveryHeader = buildCommercialHeader(
    {
      projectId,
      customerId: project.customerId,
      issueDate,
      paymentTerms,
      memo: composeInitialDocumentMemo(
        project.documentMemo,
        settings.deliveryNoteMemoTemplate
      ),
      documentEmail: documentContact.email,
      documentContactName: documentContact.contactName,
      discountLabel: project.discountLabel ?? "",
      discountAmount: project.discountAmount ?? 0,
      customerHonorific: honorific,
      ...contact,
      memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
    },
    commercialItems
  );
  const deliveryNote: DeliveryNoteRecord = {
    id: deliveryNoteId,
    orderId: order.id,
    deliveryNoteNumber,
    status: "draft",
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...deliveryHeader,
  };

  const invoiceId = generateId("inv_");
  const invoiceItemInputs = quoteItems.map((it, idx) => ({
    quoteItemId: it.id,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
  const invoiceItems = buildInvoiceItems(
    "local",
    invoiceId,
    {
      projectId,
      customerId: project.customerId,
      quoteId: quote.id,
      issueDate,
      dueDateMode: "discussion",
      dueDate: "",
      paymentTerms,
      bankAccountId: null,
      memo: composeInitialDocumentMemo(
        project.documentMemo,
        settings.invoiceMemoTemplate
      ),
      documentEmail: documentContact.email,
      documentContactName: documentContact.contactName,
      discountLabel: project.discountLabel ?? "",
      discountAmount: project.discountAmount ?? 0,
      customerHonorific: honorific,
      ...contact,
      memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
      items: invoiceItemInputs,
    },
    now
  ).map((it) => ({ ...it, id: generateId("invi_") }));
  const invoiceTotals = computeLineTotals(invoiceItems, {
    discountLabel: project.discountLabel ?? "",
    discountAmount: project.discountAmount ?? 0,
  });
  const invoice: InvoiceRecord = {
    id: invoiceId,
    projectId,
    customerId: project.customerId,
    quoteId: quote.id,
    invoiceNumber,
    issueDate,
    dueDateMode: "discussion",
    dueDate: "",
    status: "draft",
    subtotal: invoiceTotals.subtotal,
    taxAmount: invoiceTotals.taxAmount,
    totalAmount: invoiceTotals.totalAmount,
    discountLabel: project.discountLabel ?? "",
    discountAmount: project.discountAmount ?? 0,
    customerHonorific: honorific,
    ...contact,
    pdfUrl: null,
    memo: composeInitialDocumentMemo(
      project.documentMemo,
      settings.invoiceMemoTemplate
    ),
    memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
    documentEmail: documentContact.email,
    documentContactName: documentContact.contactName,
    paymentTerms,
    bankAccountId: null,
    recurringBillingId: null,
    recurringOccurrenceDate: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const receiptId = generateId("rc_");
  const receiptItemInputs = invoiceItems.map((it, idx) => ({
    itemTemplateId: null as string | null,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
  const receiptItems = buildCommercialItemRecords<ReceiptItemRecord>(
    receiptId,
    "receiptId",
    receiptItemInputs,
    "ri_"
  );
  const receiptHeader = buildCommercialHeader(
    {
      projectId,
      customerId: project.customerId,
      issueDate,
      paymentTerms,
      memo: composeInitialDocumentMemo(
        project.documentMemo,
        settings.receiptMemoTemplate
      ),
      documentEmail: documentContact.email,
      documentContactName: documentContact.contactName,
      discountLabel: project.discountLabel ?? "",
      discountAmount: project.discountAmount ?? 0,
      customerHonorific: honorific,
      ...contact,
      memoFontSize: DEFAULT_DOCUMENT_MEMO_FONT_SIZE,
    },
    receiptItemInputs
  );
  const receipt: ReceiptRecord = {
    id: receiptId,
    invoiceId: invoice.id,
    receiptNumber,
    status: "draft",
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...receiptHeader,
  };

  return {
    quote,
    quoteItems,
    order,
    orderItems,
    deliveryNote,
    deliveryNoteItems,
    invoice,
    invoiceItems,
    receipt,
    receiptItems,
  };
}

function hydrateBuiltDocuments(built: BuiltSimpleDocuments): void {
  useQuoteStore.getState().mergeQuote(built.quote, built.quoteItems);
  useOrderStore.getState().upsertOrder(built.order, built.orderItems);
  useDeliveryNoteStore
    .getState()
    .upsertDeliveryNote(built.deliveryNote, built.deliveryNoteItems);
  useInvoiceStore.getState().mergeInvoice(built.invoice, built.invoiceItems);
  useReceiptStore.getState().upsertReceipt(built.receipt, built.receiptItems);
}

function markProjectInitialized(projectId: string, at: string): void {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return;
  useProjectStore.getState().upsertProject({
    ...project,
    simpleDocumentsInitializedAt: at,
    updatedAt: at,
  });
}

/**
 * simple案件の帳票一式を生成（冪等）。
 * Supabase: RPC 1トランザクション。
 * ローカル: store へ一括 hydrate（失敗時は未初期化のまま）。
 */
export async function provisionSimpleProjectDocuments(
  projectId: string
): Promise<SimpleDocumentsProvisionResult> {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) throw new Error("案件が見つかりません");
  if (!isSimpleWorkflowMode(project.workflowMode)) {
    throw new Error("簡易モードの案件ではありません");
  }

  if (project.simpleDocumentsInitializedAt) {
    const quotes = useQuoteStore.getState().getQuotesByProjectId(projectId);
    const orders = useOrderStore.getState().getOrdersByProjectId(projectId);
    const deliveries = useDeliveryNoteStore.getState().getByProjectId(projectId);
    const invoices = useInvoiceStore
      .getState()
      .getInvoicesByProjectId(projectId);
    const receipts = useReceiptStore.getState().getByProjectId(projectId);
    return {
      alreadyInitialized: true,
      quoteId: quotes[0]?.id ?? "",
      orderId: orders[0]?.id ?? "",
      deliveryNoteId: deliveries[0]?.id ?? "",
      invoiceId: invoices[0]?.id ?? "",
      receiptId: receipts[0]?.id ?? "",
    };
  }

  const built = await buildSimpleDocuments(projectId);

  if (isSupabaseConfigured()) {
    const companyId = await resolveCompanyId();
    const payload = {
      quote: quoteToRow(companyId, built.quote),
      quote_items: built.quoteItems.map((i) => quoteItemToRow(companyId, i)),
      order: orderToRow(companyId, built.order),
      order_items: built.orderItems.map((i) => orderItemToRow(companyId, i)),
      delivery_note: deliveryNoteToRow(companyId, built.deliveryNote),
      delivery_note_items: built.deliveryNoteItems.map((i) =>
        deliveryNoteItemToRow(companyId, i)
      ),
      invoice: invoiceToRow(companyId, built.invoice),
      invoice_items: built.invoiceItems.map((i) =>
        invoiceItemToRow(companyId, i)
      ),
      receipt: receiptToRow(companyId, built.receipt),
      receipt_items: built.receiptItems.map((i) =>
        receiptItemToRow(companyId, i)
      ),
    };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.rpc(
      "provision_simple_project_documents",
      {
        p_project_id: projectId,
        p_payload: payload,
      }
    );
    if (error) {
      // 一時 merge した見積を取り除く（失敗時のゴミ）
      useQuoteStore.getState().removeQuote(built.quote.id);
      throw toUserFacingDbError(error);
    }

    const result = data as {
      already_initialized?: boolean;
      initialized_at?: string;
      quote_id?: string;
      order_id?: string;
      delivery_note_id?: string;
      invoice_id?: string;
      receipt_id?: string;
    };

    if (result.already_initialized) {
      await reloadSingleProjectToStore(projectId);
      const quotes = useQuoteStore.getState().getQuotesByProjectId(projectId);
      return {
        alreadyInitialized: true,
        quoteId: quotes[0]?.id ?? result.quote_id ?? "",
        orderId: result.order_id ?? "",
        deliveryNoteId: result.delivery_note_id ?? "",
        invoiceId: result.invoice_id ?? "",
        receiptId: result.receipt_id ?? "",
      };
    }

    hydrateBuiltDocuments(built);
    const initializedAt =
      result.initialized_at ?? new Date().toISOString();
    markProjectInitialized(projectId, initializedAt);
    await reloadSingleProjectToStore(projectId).catch(() => undefined);

    return {
      alreadyInitialized: false,
      quoteId: built.quote.id,
      orderId: built.order.id,
      deliveryNoteId: built.deliveryNote.id,
      invoiceId: built.invoice.id,
      receiptId: built.receipt.id,
    };
  }

  // ローカルモード: トランザクション相当は難しいため、一括 hydrate + フラグ
  hydrateBuiltDocuments(built);
  const initializedAt = new Date().toISOString();
  markProjectInitialized(projectId, initializedAt);

  return {
    alreadyInitialized: false,
    quoteId: built.quote.id,
    orderId: built.order.id,
    deliveryNoteId: built.deliveryNote.id,
    invoiceId: built.invoice.id,
    receiptId: built.receipt.id,
  };
}
