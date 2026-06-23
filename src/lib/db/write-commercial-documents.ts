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
  deliveryNoteItemToRow,
  deliveryNoteToRow,
  orderItemToRow,
  orderToRow,
  receiptItemToRow,
  receiptToRow,
} from "@/lib/db/commercial-mappers";
import { insertRowsWithConstructionFallback } from "@/lib/db/line-item-insert";

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

async function replaceCommercialItems<T extends { id: string }>(
  table: "order_items" | "delivery_note_items" | "receipt_items",
  parentColumn: "order_id" | "delivery_note_id" | "receipt_id",
  parentId: string,
  rows: T[],
  toRow: (companyId: string, item: T) => Record<string, unknown>
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  await supabase.from(table).delete().eq(parentColumn, parentId);
  if (rows.length === 0) return;
  await insertRowsWithConstructionFallback(
    async (insertRows) => {
      const { error } = await supabase.from(table).insert(insertRows);
      return { error };
    },
    rows.map((item) => toRow(companyId, item))
  );
}

export async function dbUpdateOrder(
  order: OrderRecord,
  items: OrderItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("orders")
    .update(orderToRow(companyId, order))
    .eq("id", order.id);
  if (error) throw error;
  await replaceCommercialItems(
    "order_items",
    "order_id",
    order.id,
    items,
    orderItemToRow
  );
}

export async function dbUpdateDeliveryNote(
  note: DeliveryNoteRecord,
  items: DeliveryNoteItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("delivery_notes")
    .update(deliveryNoteToRow(companyId, note))
    .eq("id", note.id);
  if (error) throw error;
  await replaceCommercialItems(
    "delivery_note_items",
    "delivery_note_id",
    note.id,
    items,
    deliveryNoteItemToRow
  );
}

export async function dbUpdateReceipt(
  receipt: ReceiptRecord,
  items: ReceiptItemRecord[]
): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("receipts")
    .update(receiptToRow(companyId, receipt))
    .eq("id", receipt.id);
  if (error) throw error;
  await replaceCommercialItems(
    "receipt_items",
    "receipt_id",
    receipt.id,
    items,
    receiptItemToRow
  );
}
