import type {
  QuoteInput,
  QuoteItemRecord,
  QuoteRecord,
  QuoteStatus,
} from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { getAuthUserId, withCreateAudit, withUpdateAudit } from "@/lib/db/auth-user";
import { generateId } from "@/lib/db/ids";
import {
  buildQuoteItems,
  computeLineTotals,
  quoteFromRow,
  quoteItemToRow,
  quoteToRow,
  type QuoteRow,
} from "@/lib/db/mappers";
import { dbChangeProjectStatus, dbInsertHistory } from "@/lib/db/write-projects";
import { isMissingQuoteExpiryTypeColumn } from "@/lib/db/errors";
import { insertRowsWithConstructionFallback } from "@/lib/db/line-item-insert";
import { recordActivityLog } from "@/lib/db/write-activity-log";
import {
  activityDescriptionCreated,
  activityDescriptionDeleted,
  activityDescriptionUpdated,
} from "@/lib/activity-log-messages";

async function writeQuoteRow(
  mode: "insert" | "update",
  companyId: string,
  quote: QuoteRecord,
  quoteId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getAuthUserId();
  const baseRow = quoteToRow(companyId, quote);
  const row =
    mode === "insert"
      ? withCreateAudit(baseRow, userId)
      : withUpdateAudit(baseRow, userId);

  const run = async (payload: QuoteRow & Record<string, unknown>) => {
    if (mode === "insert") {
      return supabase.from("quotes").insert(payload);
    }
    return supabase
      .from("quotes")
      .update(payload)
      .eq("id", quoteId!)
      .eq("company_id", companyId);
  };

  let { error } = await run(row);

  if (error && isMissingQuoteExpiryTypeColumn(error)) {
    const legacy = { ...row };
    delete legacy.expiry_type;
    const retry = await run(legacy);
    error = retry.error;
    if (!error) {
      console.warn(
        "quotes.expiry_type が未作成のため、タイプ以外を保存しました。supabase/add-quote-expiry-type.sql を実行してください。"
      );
    }
  }

  if (error) throw error;
}

async function nextQuoteNumber(issueDate: string, companyId: string): Promise<string> {
  const y = issueDate.slice(0, 4);
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .eq("company_id", companyId)
    .like("quote_number", `QT-${y}-%`);
  if (error) throw error;
  const n = (count ?? 0) + 1;
  return `QT-${y}-${String(n).padStart(4, "0")}`;
}

export async function dbInsertQuote(
  input: QuoteInput
): Promise<{ quote: QuoteRecord; items: QuoteItemRecord[] }> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const now = new Date().toISOString();
  const quoteId = generateId("qt_");
  const items = buildQuoteItems(companyId, quoteId, input, now).map((it) => ({
    ...it,
    id: generateId("qti_"),
  }));
  const totals = computeLineTotals(items, {
    discountLabel: input.discountLabel,
    discountAmount: input.discountAmount,
  });

  const quote: QuoteRecord = {
    id: quoteId,
    projectId: input.projectId,
    customerId: input.customerId,
    quoteNumber: await nextQuoteNumber(input.issueDate, companyId),
    issueDate: input.issueDate,
    expiryType: input.expiryType,
    expiryDate: input.expiryDate,
    status: "draft",
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    discountLabel: input.discountLabel?.trim() ?? "",
    discountAmount: input.discountAmount ?? 0,
    customerContactName: input.customerContactName?.trim() ?? "",
    customerDepartment: input.customerDepartment?.trim() ?? "",
    customerPosition: input.customerPosition?.trim() ?? "",
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await writeQuoteRow("insert", companyId, quote);

  const supabase = getSupabaseClient();
  try {
    await insertRowsWithConstructionFallback(
      async (rows) => {
        const { error } = await supabase.from("quote_items").insert(rows);
        return { error };
      },
      items.map((i) => quoteItemToRow(companyId, i))
    );
  } catch (error) {
    await supabase.from("quotes").delete().eq("id", quoteId).eq("company_id", companyId);
    throw error;
  }

  recordActivityLog({
    action: "created",
    targetType: "quote",
    targetId: quote.id,
    targetLabel: quote.quoteNumber,
    description: activityDescriptionCreated("quote", quote.quoteNumber),
  });

  return { quote, items };
}

export async function dbUpdateQuote(
  quoteId: string,
  input: QuoteInput
): Promise<{ quote: QuoteRecord; items: QuoteItemRecord[] } | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = quoteFromRow(data as QuoteRow);
  const now = new Date().toISOString();
  const items = buildQuoteItems(companyId, quoteId, input, now).map((it) => ({
    ...it,
    id: generateId("qti_"),
  }));
  const totals = computeLineTotals(items, {
    discountLabel: input.discountLabel,
    discountAmount: input.discountAmount,
  });

  const quote: QuoteRecord = {
    ...existing,
    projectId: input.projectId,
    customerId: input.customerId,
    issueDate: input.issueDate,
    expiryType: input.expiryType,
    expiryDate: input.expiryDate,
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    discountLabel: input.discountLabel?.trim() ?? "",
    discountAmount: input.discountAmount ?? 0,
    customerContactName: input.customerContactName?.trim() ?? "",
    customerDepartment: input.customerDepartment?.trim() ?? "",
    customerPosition: input.customerPosition?.trim() ?? "",
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    updatedAt: now,
  };

  await writeQuoteRow("update", companyId, quote, quoteId);

  await supabase
    .from("quote_items")
    .delete()
    .eq("quote_id", quoteId)
    .eq("company_id", companyId);
  await insertRowsWithConstructionFallback(
    async (rows) => {
      const { error } = await supabase.from("quote_items").insert(rows);
      return { error };
    },
    items.map((i) => quoteItemToRow(companyId, i))
  );

  recordActivityLog({
    action: "updated",
    targetType: "quote",
    targetId: quote.id,
    targetLabel: quote.quoteNumber,
    description: activityDescriptionUpdated("quote", quote.quoteNumber),
  });

  return { quote, items };
}

export async function dbDeleteQuote(quoteId: string): Promise<boolean> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("quotes")
    .select("quote_number")
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const quoteNumber = String(data?.quote_number ?? "");

  const { error } = await supabase
    .from("quotes")
    .delete()
    .eq("id", quoteId)
    .eq("company_id", companyId);
  if (error) throw error;

  recordActivityLog({
    action: "deleted",
    targetType: "quote",
    targetId: quoteId,
    targetLabel: quoteNumber,
    description: activityDescriptionDeleted("quote", quoteNumber),
  });

  return true;
}

export async function dbUpdateQuoteStatus(
  quoteId: string,
  status: QuoteStatus
): Promise<QuoteRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", quoteId)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const existing = quoteFromRow(data as QuoteRow);
  const updated: QuoteRecord = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  const userId = await getAuthUserId();
  const { error } = await supabase
    .from("quotes")
    .update(withUpdateAudit(quoteToRow(companyId, updated), userId))
    .eq("id", quoteId)
    .eq("company_id", companyId);
  if (error) throw error;

  if (status === "accepted") {
    await dbChangeProjectStatus(updated.projectId, "ordered");
  }
  if (status === "sent") {
    await dbChangeProjectStatus(updated.projectId, "estimate");
  }
  if (status === "rejected") {
    await dbChangeProjectStatus(updated.projectId, "lost");
  }

  const historyTitle =
    status === "sent"
      ? "見積を提出済みにしました"
      : status === "accepted"
        ? "見積が承認され、案件を受注に変更しました"
        : status === "rejected"
          ? "見積が否認されました"
          : "見積を下書きに戻しました";

  await dbInsertHistory({
    projectId: updated.projectId,
    type: "status_changed",
    title: historyTitle,
    description: `見積 ${updated.quoteNumber}`,
  });

  recordActivityLog({
    action: "updated",
    targetType: "quote",
    targetId: updated.id,
    targetLabel: updated.quoteNumber,
    description: activityDescriptionUpdated("quote", updated.quoteNumber),
  });

  return updated;
}
