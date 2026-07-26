import type {
  DeliveryNoteItemRecord,
  DeliveryNoteRecord,
  OrderItemRecord,
  OrderRecord,
  ReceiptItemRecord,
  ReceiptRecord,
} from "@/lib/commercial-document";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import {
  deliveryNoteFromRow,
  deliveryNoteItemFromRow,
  deliveryNoteItemToRow,
  deliveryNoteToRow,
  orderFromRow,
  orderItemFromRow,
  orderItemToRow,
  orderToRow,
  receiptFromRow,
  receiptItemFromRow,
  receiptItemToRow,
  receiptToRow,
  type DeliveryNoteItemRow,
  type DeliveryNoteRow,
  type OrderItemRow,
  type OrderRow,
  type ReceiptItemRow,
  type ReceiptRow,
} from "@/lib/db/commercial-mappers";
import { insertRowsWithConstructionFallback } from "@/lib/db/line-item-insert";
import {
  UPDATE_DELIVERY_NOTE_WITH_ITEMS_RPC_HINT,
  UPDATE_ORDER_WITH_ITEMS_RPC_HINT,
  UPDATE_RECEIPT_WITH_ITEMS_RPC_HINT,
} from "@/lib/db/errors";
import { callUpdateWithItemsRpc } from "@/lib/db/update-with-items-rpc";

const DOCUMENTS_RPC_SQL = "supabase/add-update-documents-with-items-rpcs.sql";

export async function dbInsertOrder(
  order: OrderRecord,
  items: OrderItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("orders").insert(orderToRow(companyId, order));
  if (error) throw error;
  if (items.length > 0) {
    await insertRowsWithConstructionFallback(
      async (rows) => {
        const { error } = await supabase.from("order_items").insert(rows);
        return { error };
      },
      items.map((i) => orderItemToRow(companyId, i))
    );
  }
}

export async function dbInsertDeliveryNote(
  note: DeliveryNoteRecord,
  items: DeliveryNoteItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("delivery_notes")
    .insert(deliveryNoteToRow(companyId, note));
  if (error) throw error;
  if (items.length > 0) {
    await insertRowsWithConstructionFallback(
      async (rows) => {
        const { error } = await supabase.from("delivery_note_items").insert(rows);
        return { error };
      },
      items.map((i) => deliveryNoteItemToRow(companyId, i))
    );
  }
}

export async function dbInsertReceipt(
  receipt: ReceiptRecord,
  items: ReceiptItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("receipts")
    .insert(receiptToRow(companyId, receipt));
  if (error) throw error;
  if (items.length > 0) {
    await insertRowsWithConstructionFallback(
      async (rows) => {
        const { error } = await supabase.from("receipt_items").insert(rows);
        return { error };
      },
      items.map((i) => receiptItemToRow(companyId, i))
    );
  }
}

function orderUpdatePayload(order: OrderRecord): Record<string, unknown> {
  return {
    project_id: order.projectId,
    customer_id: order.customerId,
    quote_id: order.quoteId,
    recipient_name: order.recipientName,
    issue_date: order.issueDate,
    payment_terms: order.paymentTerms,
    status: order.status,
    subtotal: order.subtotal,
    tax_amount: order.taxAmount,
    total_amount: order.totalAmount,
    discount_label: order.discountLabel,
    discount_amount: order.discountAmount,
    customer_contact_name: order.customerContactName,
    customer_department: order.customerDepartment,
    customer_position: order.customerPosition,
    memo: order.memo,
    updated_at: order.updatedAt,
  };
}

function deliveryNoteUpdatePayload(note: DeliveryNoteRecord): Record<string, unknown> {
  return {
    project_id: note.projectId,
    customer_id: note.customerId,
    order_id: note.orderId,
    issue_date: note.issueDate,
    payment_terms: note.paymentTerms,
    status: note.status,
    subtotal: note.subtotal,
    tax_amount: note.taxAmount,
    total_amount: note.totalAmount,
    discount_label: note.discountLabel,
    discount_amount: note.discountAmount,
    customer_honorific: note.customerHonorific,
    customer_contact_name: note.customerContactName,
    customer_department: note.customerDepartment,
    customer_position: note.customerPosition,
    memo: note.memo,
    updated_at: note.updatedAt,
  };
}

function receiptUpdatePayload(receipt: ReceiptRecord): Record<string, unknown> {
  return {
    project_id: receipt.projectId,
    customer_id: receipt.customerId,
    invoice_id: receipt.invoiceId,
    issue_date: receipt.issueDate,
    payment_terms: receipt.paymentTerms,
    status: receipt.status,
    subtotal: receipt.subtotal,
    tax_amount: receipt.taxAmount,
    total_amount: receipt.totalAmount,
    discount_label: receipt.discountLabel,
    discount_amount: receipt.discountAmount,
    customer_honorific: receipt.customerHonorific,
    customer_contact_name: receipt.customerContactName,
    customer_department: receipt.customerDepartment,
    customer_position: receipt.customerPosition,
    memo: receipt.memo,
    updated_at: receipt.updatedAt,
  };
}

export async function dbUpdateOrder(
  order: OrderRecord,
  items: OrderItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const rpcResult = await callUpdateWithItemsRpc({
    rpcName: "update_order_with_items",
    sqlFile: DOCUMENTS_RPC_SQL,
    hint: UPDATE_ORDER_WITH_ITEMS_RPC_HINT,
    parentIdParam: "p_order_id",
    parentId: order.id,
    parentPayload: orderUpdatePayload(order),
    parentPayloadKey: "p_order",
    itemsPayload: items.map((i) => orderItemToRow(companyId, i)),
    companyId,
    notFoundMessageIncludes: "order not found",
  });
  if (!rpcResult?.order) {
    throw new Error("注文書の更新結果を取得できませんでした");
  }
  // 結果の検証（mapper で読めること）
  orderFromRow(rpcResult.order as OrderRow);
  if (Array.isArray(rpcResult.items)) {
    (rpcResult.items as OrderItemRow[]).forEach((row) => orderItemFromRow(row));
  }
}

export async function dbUpdateDeliveryNote(
  note: DeliveryNoteRecord,
  items: DeliveryNoteItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const rpcResult = await callUpdateWithItemsRpc({
    rpcName: "update_delivery_note_with_items",
    sqlFile: DOCUMENTS_RPC_SQL,
    hint: UPDATE_DELIVERY_NOTE_WITH_ITEMS_RPC_HINT,
    parentIdParam: "p_delivery_note_id",
    parentId: note.id,
    parentPayload: deliveryNoteUpdatePayload(note),
    parentPayloadKey: "p_delivery_note",
    itemsPayload: items.map((i) => deliveryNoteItemToRow(companyId, i)),
    companyId,
    notFoundMessageIncludes: "delivery_note not found",
  });
  if (!rpcResult?.delivery_note) {
    throw new Error("納品書の更新結果を取得できませんでした");
  }
  deliveryNoteFromRow(rpcResult.delivery_note as DeliveryNoteRow);
  if (Array.isArray(rpcResult.items)) {
    (rpcResult.items as DeliveryNoteItemRow[]).forEach((row) =>
      deliveryNoteItemFromRow(row)
    );
  }
}

export async function dbUpdateReceipt(
  receipt: ReceiptRecord,
  items: ReceiptItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const rpcResult = await callUpdateWithItemsRpc({
    rpcName: "update_receipt_with_items",
    sqlFile: DOCUMENTS_RPC_SQL,
    hint: UPDATE_RECEIPT_WITH_ITEMS_RPC_HINT,
    parentIdParam: "p_receipt_id",
    parentId: receipt.id,
    parentPayload: receiptUpdatePayload(receipt),
    parentPayloadKey: "p_receipt",
    itemsPayload: items.map((i) => receiptItemToRow(companyId, i)),
    companyId,
    notFoundMessageIncludes: "receipt not found",
  });
  if (!rpcResult?.receipt) {
    throw new Error("領収書の更新結果を取得できませんでした");
  }
  receiptFromRow(rpcResult.receipt as ReceiptRow);
  if (Array.isArray(rpcResult.items)) {
    (rpcResult.items as ReceiptItemRow[]).forEach((row) => receiptItemFromRow(row));
  }
}

export async function dbSoftDeleteOrder(orderId: string): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", orderId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function dbSoftDeleteDeliveryNote(deliveryNoteId: string): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("delivery_notes")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", deliveryNoteId)
    .eq("company_id", companyId);
  if (error) throw error;
}

export async function dbSoftDeleteReceipt(receiptId: string): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("receipts")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", receiptId)
    .eq("company_id", companyId);
  if (error) throw error;
}
