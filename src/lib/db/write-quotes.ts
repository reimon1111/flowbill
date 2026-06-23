import type {
  QuoteInput,
  QuoteItemRecord,
  QuoteRecord,
  QuoteStatus,
} from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
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

async function writeQuoteRow(
  mode: "insert" | "update",
  companyId: string,
  quote: QuoteRecord,
  quoteId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const row = quoteToRow(companyId, quote);

  const run = async (payload: QuoteRow) => {
    if (mode === "insert") {
      return supabase.from("quotes").insert(payload);
    }
    return supabase.from("quotes").update(payload).eq("id", quoteId!);
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

async function nextQuoteNumber(issueDate: string): Promise<string> {
  const y = issueDate.slice(0, 4);
  const supabase = getSupabaseClient();
  const { count, error } = await supabase
    .from("quotes")
    .select("*", { count: "exact", head: true })
    .like("quote_number", `QT-${y}-%`);
  if (error) throw error;
  const n = (count ?? 0) + 1;
  return `QT-${y}-${String(n).padStart(4, "0")}`;
}

export async function dbInsertQuote(
  input: QuoteInput
): Promise<{ quote: QuoteRecord; items: QuoteItemRecord[] }> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const quoteId = generateId("qt_");
  const items = buildQuoteItems(companyId, quoteId, input, now).map((it) => ({
    ...it,
    id: generateId("qti_"),
  }));
  const totals = computeLineTotals(items);

  const quote: QuoteRecord = {
    id: quoteId,
    projectId: input.projectId,
    customerId: input.customerId,
    quoteNumber: await nextQuoteNumber(input.issueDate),
    issueDate: input.issueDate,
    expiryType: input.expiryType,
    expiryDate: input.expiryDate,
    status: "draft",
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
    memo: input.memo,
    paymentTerms: input.paymentTerms,
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
    await supabase.from("quotes").delete().eq("id", quoteId);
    throw error;
  }

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
    .single();
  if (fetchError || !data) return null;

  const existing = quoteFromRow(data as QuoteRow);
  const now = new Date().toISOString();
  const items = buildQuoteItems(companyId, quoteId, input, now).map((it) => ({
    ...it,
    id: generateId("qti_"),
  }));
  const totals = computeLineTotals(items);

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
    memo: input.memo,
    paymentTerms: input.paymentTerms,
    updatedAt: now,
  };

  await writeQuoteRow("update", companyId, quote, quoteId);

  await supabase.from("quote_items").delete().eq("quote_id", quoteId);
  await insertRowsWithConstructionFallback(
    async (rows) => {
      const { error } = await supabase.from("quote_items").insert(rows);
      return { error };
    },
    items.map((i) => quoteItemToRow(companyId, i))
  );

  return { quote, items };
}

export async function dbDeleteQuote(quoteId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw error;
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
    .single();
  if (fetchError || !data) return null;

  const existing = quoteFromRow(data as QuoteRow);
  const updated: QuoteRecord = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("quotes")
    .update(quoteToRow(companyId, updated))
    .eq("id", quoteId);
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

  return updated;
}
