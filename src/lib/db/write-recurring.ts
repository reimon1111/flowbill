import type {
  InvoiceRecord,
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
  invoiceFromRow,
  recurringFromRow,
  recurringItemFromRow,
  recurringItemToRow,
  recurringToRow,
  type InvoiceRow,
  type RecurringBillingItemRow,
  type RecurringBillingRow,
} from "@/lib/db/mappers";
import {
  INVOICE_RECURRING_OCCURRENCE_MIGRATION_HINT,
  UPDATE_RECURRING_WITH_ITEMS_RPC_HINT,
  isMissingInvoiceRecurringOccurrenceColumns,
} from "@/lib/db/errors";
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

/** 同一定期請求×請求回の有効 invoice（deleted_at IS NULL）を取得 */
export async function dbFindActiveRecurringOccurrenceInvoice(
  recurringBillingId: string,
  occurrenceDate: string
): Promise<InvoiceRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("company_id", companyId)
    .eq("recurring_billing_id", recurringBillingId)
    .eq("recurring_occurrence_date", occurrenceDate)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingInvoiceRecurringOccurrenceColumns(error)) {
      console.warn(INVOICE_RECURRING_OCCURRENCE_MIGRATION_HINT);
      return null;
    }
    throw error;
  }
  if (!data) return null;
  return invoiceFromRow(data as InvoiceRow);
}

/**
 * next_billing_date が occurrenceDate と一致するときだけ1ヶ月進める。
 * Supabase: FOR UPDATE + 条件付き更新 RPC。
 */
export async function dbAdvanceRecurringAfterInvoice(
  recurringId: string,
  occurrenceDate: string
): Promise<RecurringBillingRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.rpc(
    "advance_recurring_billing_if_occurrence",
    {
      p_recurring_billing_id: recurringId,
      p_occurrence_date: occurrenceDate,
    }
  );

  if (error) {
    // RPC 未適用時のフォールバック: 条件付き update（二重 advance は抑止、行ロックは弱い）
    if (
      error.code === "PGRST202" ||
      String(error.message ?? "")
        .toLowerCase()
        .includes("advance_recurring_billing_if_occurrence")
    ) {
      console.warn(
        "advance_recurring_billing_if_occurrence が未適用です。supabase/add-invoice-recurring-occurrence.sql を実行してください。"
      );
      return dbAdvanceRecurringAfterInvoiceFallback(
        recurringId,
        occurrenceDate,
        companyId
      );
    }
    throw error;
  }

  const payload = data as {
    advanced?: boolean;
    recurring_billing?: RecurringBillingRow;
  } | null;
  const row = payload?.recurring_billing;
  if (!row) {
    const { data: fresh, error: fetchError } = await supabase
      .from("recurring_billings")
      .select("*")
      .eq("id", recurringId)
      .eq("company_id", companyId)
      .maybeSingle();
    if (fetchError || !fresh) return null;
    return recurringFromRow(fresh as RecurringBillingRow);
  }
  return recurringFromRow(row);
}

async function dbAdvanceRecurringAfterInvoiceFallback(
  recurringId: string,
  occurrenceDate: string,
  companyId: string
): Promise<RecurringBillingRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("recurring_billings")
    .select("*")
    .eq("id", recurringId)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = recurringFromRow(data as RecurringBillingRow);
  if (existing.status !== "active") return existing;
  if (existing.nextBillingDate !== occurrenceDate) return existing;

  const updated: RecurringBillingRecord = {
    ...existing,
    nextBillingDate: advanceNextBillingDate(
      occurrenceDate,
      existing.billingDay
    ),
    updatedAt: new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from("recurring_billings")
    .update(recurringToRow(companyId, updated))
    .eq("id", recurringId)
    .eq("company_id", companyId)
    .eq("next_billing_date", occurrenceDate)
    .select("*")
    .maybeSingle();

  if (error) throw error;
  if (!saved) {
    // 他リクエストが進めた
    const { data: fresh } = await supabase
      .from("recurring_billings")
      .select("*")
      .eq("id", recurringId)
      .eq("company_id", companyId)
      .maybeSingle();
    return fresh
      ? recurringFromRow(fresh as RecurringBillingRow)
      : existing;
  }
  return recurringFromRow(saved as RecurringBillingRow);
}
