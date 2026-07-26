import type {
  RecurringBillingInput,
  RecurringBillingItemRecord,
  RecurringBillingRecord,
  RecurringBillingStatus,
} from "@/lib/types";
import { advanceNextBillingDate } from "@/lib/recurring-utils";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import {
  buildRecurringItems,
  computeLineTotals,
  recurringFromRow,
  recurringItemFromRow,
  recurringItemToRow,
  recurringToRow,
  type RecurringBillingItemRow,
  type RecurringBillingRow,
} from "@/lib/db/mappers";
import { UPDATE_RECURRING_WITH_ITEMS_RPC_HINT } from "@/lib/db/errors";
import { callUpdateWithItemsRpc } from "@/lib/db/update-with-items-rpc";

export async function dbInsertRecurring(
  input: RecurringBillingInput
): Promise<{ billing: RecurringBillingRecord; items: RecurringBillingItemRecord[] }> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const recurringId = generateId("rb_");
  const items = buildRecurringItems(recurringId, input, now).map((it) => ({
    ...it,
    id: generateId("rbi_"),
  }));
  const totals = computeLineTotals(items);

  const billing: RecurringBillingRecord = {
    id: recurringId,
    customerId: input.customerId,
    title: input.title,
    billingDay: input.billingDay,
    nextBillingDate: input.nextBillingDate,
    status: "active",
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    discountLabel: "",
    discountAmount: 0,
    memo: input.memo,
    createdAt: now,
    updatedAt: now,
  };

  const supabase = getSupabaseClient();
  const { error: rbError } = await supabase
    .from("recurring_billings")
    .insert(recurringToRow(companyId, billing));
  if (rbError) throw rbError;

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("recurring_billing_items")
      .insert(items.map((i) => recurringItemToRow(companyId, i)));
    if (itemsError) throw itemsError;
  }

  return { billing, items };
}

export async function dbUpdateRecurring(
  recurringId: string,
  input: RecurringBillingInput
): Promise<{ billing: RecurringBillingRecord; items: RecurringBillingItemRecord[] } | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("recurring_billings")
    .select("*")
    .eq("id", recurringId)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = recurringFromRow(data as RecurringBillingRow);
  if (existing.status === "ended") return null;

  const now = new Date().toISOString();
  const items = buildRecurringItems(recurringId, input, now).map((it) => ({
    ...it,
    id: generateId("rbi_"),
  }));
  const totals = computeLineTotals(items);

  const billing: RecurringBillingRecord = {
    ...existing,
    customerId: input.customerId,
    title: input.title,
    billingDay: input.billingDay,
    nextBillingDate: input.nextBillingDate,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    discountLabel: "",
    discountAmount: 0,
    memo: input.memo,
    updatedAt: now,
  };

  const billingPayload = {
    customer_id: billing.customerId,
    title: billing.title,
    billing_day: billing.billingDay,
    next_billing_date: billing.nextBillingDate,
    status: billing.status,
    subtotal: billing.subtotal,
    tax_amount: billing.taxAmount,
    total_amount: billing.totalAmount,
    memo: billing.memo,
    updated_at: billing.updatedAt,
  };

  const rpcResult = await callUpdateWithItemsRpc({
    rpcName: "update_recurring_billing_with_items",
    sqlFile: "supabase/add-update-documents-with-items-rpcs.sql",
    hint: UPDATE_RECURRING_WITH_ITEMS_RPC_HINT,
    parentIdParam: "p_recurring_billing_id",
    parentId: recurringId,
    parentPayload: billingPayload,
    parentPayloadKey: "p_recurring_billing",
    itemsPayload: items.map((i) => recurringItemToRow(companyId, i)),
    companyId,
    notFoundMessageIncludes: "recurring billing not found",
  });
  if (!rpcResult) return null;

  const savedRow = rpcResult.recurring_billing as RecurringBillingRow | undefined;
  if (!savedRow) {
    throw new Error("定期請求の更新結果を取得できませんでした");
  }
  const savedBilling = recurringFromRow(savedRow);
  const savedItems = Array.isArray(rpcResult.items)
    ? (rpcResult.items as RecurringBillingItemRow[]).map((row) =>
        recurringItemFromRow(row)
      )
    : items;

  return { billing: savedBilling, items: savedItems };
}

export async function dbUpdateRecurringStatus(
  recurringId: string,
  status: RecurringBillingStatus
): Promise<RecurringBillingRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("recurring_billings")
    .select("*")
    .eq("id", recurringId)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = recurringFromRow(data as RecurringBillingRow);
  if (existing.status === "ended" && status !== "ended") return null;

  const updated: RecurringBillingRecord = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("recurring_billings")
    .update(recurringToRow(companyId, updated))
    .eq("id", recurringId)
    .eq("company_id", companyId);
  if (error) throw error;
  return updated;
}

export async function dbAdvanceRecurringAfterInvoice(
  recurringId: string
): Promise<RecurringBillingRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("recurring_billings")
    .select("*")
    .eq("id", recurringId)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = recurringFromRow(data as RecurringBillingRow);
  if (existing.status !== "active") return null;

  const updated: RecurringBillingRecord = {
    ...existing,
    nextBillingDate: advanceNextBillingDate(
      existing.nextBillingDate,
      existing.billingDay
    ),
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("recurring_billings")
    .update(recurringToRow(companyId, updated))
    .eq("id", recurringId)
    .eq("company_id", companyId);
  if (error) throw error;
  return updated;
}
