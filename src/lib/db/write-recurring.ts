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
  recurringItemToRow,
  recurringToRow,
  type RecurringBillingRow,
} from "@/lib/db/mappers";

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

  const { error: updateError } = await supabase
    .from("recurring_billings")
    .update(recurringToRow(companyId, billing))
    .eq("id", recurringId);
  if (updateError) throw updateError;

  await supabase.from("recurring_billing_items").delete().eq("recurring_billing_id", recurringId);
  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from("recurring_billing_items")
      .insert(items.map((i) => recurringItemToRow(companyId, i)));
    if (itemsError) throw itemsError;
  }

  return { billing, items };
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
    .eq("id", recurringId);
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
    .eq("id", recurringId);
  if (error) throw error;
  return updated;
}
