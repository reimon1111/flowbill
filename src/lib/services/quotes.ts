import type {
  ProjectRecord,
  QuoteInput,
  QuoteItemRecord,
  QuoteListItem,
  QuoteRecord,
  QuoteStatus,
} from "@/lib/types";
import type { QuoteFormValues } from "@/lib/validations/quote";
import { useQuoteStore } from "@/stores/quote-store";
import { useProjectStore } from "@/stores/project-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbDeleteQuote,
  dbInsertQuote,
  dbUpdateQuote,
  dbUpdateQuoteStatus,
} from "@/lib/db/write-quotes";
import { dbInsertHistory } from "@/lib/db/write-projects";
import { reloadSingleProjectToStore } from "@/lib/db/load-all";
import { logSupabaseError, formatSupabaseError } from "@/lib/db/errors";
import { todayISO } from "@/lib/quote-dates";
import {
  DEFAULT_QUOTE_EXPIRY_TYPE,
  calculateQuoteExpiryDate,
  resolveQuoteExpiryDate,
} from "@/lib/quote-expiry";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { assertCanWriteBusinessData } from "@/lib/guards/write-access";
import { normalizeUnit } from "@/lib/constants/units";
import { buildQuoteInputItemsForProject, quoteNeedsItemSync } from "@/lib/services/project-items";

export const QUOTE_DELETE_BLOCKED_MESSAGE =
  "この見積書は承認済み、または請求書に紐づいているため削除できません。";

export function getQuoteDeletionBlockReason(quoteId: string): string | null {
  const quote = useQuoteStore.getState().getQuoteById(quoteId);
  if (!quote) return "見積が見つかりません";

  if (quote.status === "accepted") {
    return QUOTE_DELETE_BLOCKED_MESSAGE;
  }

  const linkedInvoice = useInvoiceStore
    .getState()
    .getInvoices()
    .find(
      (inv) =>
        inv.quoteId === quoteId &&
        inv.status !== "cancelled" &&
        inv.quoteId.length > 0
    );
  if (linkedInvoice) {
    if (linkedInvoice.status === "draft") {
      return "この見積書は下書き請求書に紐づいているため削除できません。先に請求書の下書きを削除してください。";
    }
    return QUOTE_DELETE_BLOCKED_MESSAGE;
  }

  if (quote.status === "draft" || quote.status === "sent") {
    return null;
  }

  return QUOTE_DELETE_BLOCKED_MESSAGE;
}

export function canDeleteQuote(quoteId: string): boolean {
  return getQuoteDeletionBlockReason(quoteId) === null;
}

async function appendQuoteDeletedHistory(
  projectId: string,
  quoteNumber: string
) {
  const payload = {
    projectId,
    type: "updated" as const,
    title: "見積を削除しました",
    description: quoteNumber,
  };

  if (isSupabaseConfigured()) {
    const event = await dbInsertHistory(payload);
    const store = useProjectStore.getState();
    store.hydrate({
      projects: store.projects,
      histories: [event, ...store.histories.filter((h) => h.id !== event.id)],
    });
    return;
  }

  useProjectStore.getState().addHistory(payload);
}

async function appendQuoteDraftHistory(projectId: string, quoteNumber: string) {
  const payload = {
    projectId,
    type: "updated" as const,
    title: "見積下書きを作成",
    description: quoteNumber,
  };

  if (isSupabaseConfigured()) {
    const event = await dbInsertHistory(payload);
    const store = useProjectStore.getState();
    store.hydrate({
      projects: store.projects,
      histories: [event, ...store.histories.filter((h) => h.id !== event.id)],
    });
    return;
  }

  useProjectStore.getState().addHistory(payload);
}

function buildQuoteInputFromProject(
  quote: QuoteRecord,
  project: Pick<ProjectRecord, "id" | "customerId" | "amount" | "projectName">
): QuoteInput {
  return {
    projectId: quote.projectId,
    customerId: quote.customerId,
    issueDate: quote.issueDate,
    expiryType: quote.expiryType,
    expiryDate: quote.expiryDate,
    paymentTerms: quote.paymentTerms,
    memo: quote.memo,
    items: buildQuoteInputItemsForProject(
      project.id,
      project.projectName,
      project.amount ?? 0
    ),
  };
}

export async function syncQuoteItemsFromProject(
  quote: QuoteRecord,
  project: Pick<ProjectRecord, "id" | "customerId" | "amount" | "projectName">
): Promise<QuoteRecord> {
  const updated = await updateQuote(quote.id, buildQuoteInputFromProject(quote, project));
  return updated ?? quote;
}

/** 案件に紐づく見積下書きがなければ1件作成（見積前ステータス用） */
export async function ensureDraftQuoteForProject(
  project: Pick<ProjectRecord, "id" | "customerId" | "amount" | "projectName">
): Promise<QuoteRecord | null> {
  const existing = useQuoteStore
    .getState()
    .getQuotesByProjectId(project.id)
    .sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  if (existing.length > 0) {
    const quote = existing[0];
    if (quoteNeedsItemSync(quote)) {
      return syncQuoteItemsFromProject(quote, project);
    }
    return quote;
  }

  const issueDate = todayISO();
  const expiryType =
    useCompanySettingsStore.getState().settings.quoteDefaultExpiryType ??
    DEFAULT_QUOTE_EXPIRY_TYPE;
  const input: QuoteInput = {
    projectId: project.id,
    customerId: project.customerId,
    issueDate,
    expiryType,
    expiryDate: calculateQuoteExpiryDate(issueDate, expiryType),
    paymentTerms:
      useCompanySettingsStore.getState().settings.paymentTerms ?? "",
    memo: useCompanySettingsStore.getState().settings.quoteMemoTemplate ?? "",
    items: buildQuoteInputItemsForProject(
      project.id,
      project.projectName,
      project.amount ?? 0
    ),
  };

  try {
    const quote = await createQuote(input);
    await appendQuoteDraftHistory(project.id, quote.quoteNumber);
    return quote;
  } catch (error) {
    logSupabaseError("ensureDraftQuoteForProject error", error);
    throw error;
  }
}

export async function getQuotes(): Promise<QuoteListItem[]> {
  return useQuoteStore.getState().getListItems();
}

export async function getQuoteById(id: string): Promise<QuoteRecord | null> {
  return useQuoteStore.getState().getQuoteById(id) ?? null;
}

export async function getQuoteItems(quoteId: string): Promise<QuoteItemRecord[]> {
  return useQuoteStore.getState().getQuoteItems(quoteId);
}

export async function getQuotesByProjectId(projectId: string): Promise<QuoteRecord[]> {
  return useQuoteStore.getState().getQuotesByProjectId(projectId);
}

/** 案件金額・明細変更時、下書き見積へ反映 */
export async function syncDraftQuoteFromProject(
  project: Pick<ProjectRecord, "id" | "customerId" | "amount" | "projectName" | "status">
): Promise<void> {
  if (project.status !== "estimate") return;

  const draft = useQuoteStore
    .getState()
    .getQuotesByProjectId(project.id)
    .find((q) => q.status === "draft");

  if (!draft) {
    await ensureDraftQuoteForProject(project);
    return;
  }

  await syncQuoteItemsFromProject(draft, project);
}

export async function createQuote(input: QuoteInput): Promise<QuoteRecord> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    const { quote, items } = await dbInsertQuote(input);
    useQuoteStore.getState().mergeQuote(quote, items);
    return quote;
  }
  return useQuoteStore.getState().createQuote(input);
}

export async function updateQuote(id: string, input: QuoteInput): Promise<QuoteRecord | null> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    const result = await dbUpdateQuote(id, input);
    if (result) useQuoteStore.getState().mergeQuote(result.quote, result.items);
    return result?.quote ?? null;
  }
  return useQuoteStore.getState().updateQuote(id, input);
}

export async function deleteQuote(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  assertCanWriteBusinessData();
  const blockReason = getQuoteDeletionBlockReason(id);
  if (blockReason) {
    return { ok: false, reason: blockReason };
  }

  const quote = useQuoteStore.getState().getQuoteById(id);
  if (!quote) {
    return { ok: false, reason: "見積が見つかりません" };
  }

  try {
    if (isSupabaseConfigured()) {
      const ok = await dbDeleteQuote(id);
      if (!ok) {
        return { ok: false, reason: "見積の削除に失敗しました" };
      }
      useQuoteStore.getState().removeQuote(id);
      try {
        await appendQuoteDeletedHistory(quote.projectId, quote.quoteNumber);
      } catch (historyError) {
        logSupabaseError("見積削除後の履歴追加", historyError);
      }
      return { ok: true };
    }

    const ok = useQuoteStore.getState().deleteQuote(id);
    if (ok) {
      await appendQuoteDeletedHistory(quote.projectId, quote.quoteNumber);
    }
    return ok ? { ok: true } : { ok: false, reason: "見積の削除に失敗しました" };
  } catch (error) {
    logSupabaseError("deleteQuote", error);
    return { ok: false, reason: formatSupabaseError(error) };
  }
}

export async function updateQuoteStatus(
  id: string,
  status: QuoteStatus
): Promise<QuoteRecord | null> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    const quote = await dbUpdateQuoteStatus(id, status);
    if (quote) {
      useQuoteStore.getState().mergeQuote(quote, useQuoteStore.getState().getQuoteItems(id));
      await reloadSingleProjectToStore(quote.projectId);
    }
    return quote;
  }
  return useQuoteStore.getState().updateQuoteStatus(id, status);
}

export function quoteInputFromForm(values: QuoteFormValues): QuoteInput {
  const expiryDate = resolveQuoteExpiryDate(
    values.issueDate,
    values.expiryType,
    values.expiryDate
  );
  return {
    projectId: values.projectId,
    customerId: values.customerId,
    issueDate: values.issueDate,
    expiryType: values.expiryType,
    expiryDate,
    paymentTerms: values.paymentTerms.trim(),
    memo: values.memo.trim(),
    items: values.items.map((i, idx) => ({
      itemTemplateId: i.itemTemplateId,
      name: i.name.trim(),
      description: i.description.trim(),
      width: i.width?.trim() ?? "",
      height: i.height?.trim() ?? "",
      quantity: i.quantity,
      unit: normalizeUnit(i.unit),
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      sortOrder: i.sortOrder ?? idx,
    })),
  };
}
