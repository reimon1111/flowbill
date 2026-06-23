import type {
  InvoiceInput,
  InvoiceItemRecord,
  InvoiceListItem,
  InvoiceRecord,
  InvoiceDocumentStatus,
} from "@/lib/types";
import type { InvoiceFormValues } from "@/lib/validations/invoice";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useProjectStore } from "@/stores/project-store";
import {
  resolveBankAccountIdForInvoice,
} from "@/lib/services/bank-accounts";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbDeleteInvoice,
  dbInsertInvoice,
  dbUpdateInvoice,
  dbUpdateInvoiceStatus,
} from "@/lib/db/write-invoices";
import { dbInsertHistory, dbUpsertProject } from "@/lib/db/write-projects";
import { reloadInvoicesToStore, reloadProjectsToStore } from "@/lib/db/load-all";
import { dbRefreshOverdueInvoices } from "@/lib/db/write-invoices";
import { resolveProjectFieldsAfterInvoiceChange } from "@/lib/invoice-project-sync";
import { normalizeUnit } from "@/lib/constants/units";
import { buildInvoiceInputItemsForProject } from "@/lib/services/project-items";
import { syncQuoteItemsFromProject } from "@/lib/services/quotes";

export const INVOICE_DELETE_BLOCKED_MESSAGE =
  "この請求書は発行済み、または入金管理に関わるため削除できません。必要な場合はキャンセルしてください。";

export const INVOICE_CANCEL_BLOCKED_PAID_MESSAGE =
  "入金済みの請求書はキャンセルできません。";

export function getInvoiceDeletionBlockReason(invoiceId: string): string | null {
  const invoice = useInvoiceStore.getState().getInvoiceById(invoiceId);
  if (!invoice) return "請求書が見つかりません";
  if (invoice.status !== "draft") {
    return INVOICE_DELETE_BLOCKED_MESSAGE;
  }
  return null;
}

export function canDeleteInvoice(invoiceId: string): boolean {
  return getInvoiceDeletionBlockReason(invoiceId) === null;
}

export function getInvoiceCancelBlockReason(invoiceId: string): string | null {
  const invoice = useInvoiceStore.getState().getInvoiceById(invoiceId);
  if (!invoice) return "請求書が見つかりません";
  if (invoice.status === "paid") {
    return INVOICE_CANCEL_BLOCKED_PAID_MESSAGE;
  }
  if (invoice.status === "cancelled") {
    return "すでにキャンセル済みです。";
  }
  if (invoice.status === "draft") {
    return "下書きの請求書は削除してください。";
  }
  return null;
}

export function canCancelInvoice(invoiceId: string): boolean {
  return getInvoiceCancelBlockReason(invoiceId) === null;
}

async function appendInvoiceDeletedHistory(
  projectId: string,
  invoiceNumber: string
) {
  const payload = {
    projectId,
    type: "updated" as const,
    title: "請求書（下書き）を削除しました",
    description: invoiceNumber,
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

function syncProjectAfterInvoiceRemoval(
  projectId: string,
  removedInvoiceId: string
) {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return;

  const derived = resolveProjectFieldsAfterInvoiceChange(
    projectId,
    useInvoiceStore.getState().getInvoices(),
    { excludeInvoiceId: removedInvoiceId }
  );

  useProjectStore.getState().upsertProject({
    ...project,
    ...derived,
    updatedAt: new Date().toISOString(),
  });
}

async function syncProjectAfterInvoiceRemovalDb(
  projectId: string,
  removedInvoiceId: string
) {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return;

  const derived = resolveProjectFieldsAfterInvoiceChange(
    projectId,
    useInvoiceStore.getState().getInvoices(),
    { excludeInvoiceId: removedInvoiceId }
  );

  await dbUpsertProject({
    ...project,
    ...derived,
    updatedAt: new Date().toISOString(),
  });
}

export async function getInvoices(): Promise<InvoiceListItem[]> {
  return useInvoiceStore.getState().getListItems();
}

export async function getInvoiceById(id: string): Promise<InvoiceRecord | null> {
  return useInvoiceStore.getState().getInvoiceById(id) ?? null;
}

export async function getInvoiceItems(invoiceId: string): Promise<InvoiceItemRecord[]> {
  return useInvoiceStore.getState().getInvoiceItems(invoiceId);
}

export async function getInvoicesByProjectId(projectId: string): Promise<InvoiceRecord[]> {
  return useInvoiceStore.getState().getInvoicesByProjectId(projectId);
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceRecord> {
  const bankAccountId = await resolveBankAccountIdForInvoice(input.bankAccountId);
  const payload = { ...input, bankAccountId };

  if (isSupabaseConfigured()) {
    const { invoice, items } = await dbInsertInvoice(payload);
    useInvoiceStore.getState().mergeInvoice(invoice, items);
    return invoice;
  }
  return useInvoiceStore.getState().createInvoice(payload);
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceRecord | null> {
  const bankAccountId = await resolveBankAccountIdForInvoice(input.bankAccountId);
  const payload = { ...input, bankAccountId };

  if (isSupabaseConfigured()) {
    const result = await dbUpdateInvoice(id, payload);
    if (result) useInvoiceStore.getState().mergeInvoice(result.invoice, result.items);
    return result?.invoice ?? null;
  }
  return useInvoiceStore.getState().updateInvoice(id, payload);
}

export async function deleteInvoice(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const blockReason = getInvoiceDeletionBlockReason(id);
  if (blockReason) {
    return { ok: false, reason: blockReason };
  }

  const invoice = useInvoiceStore.getState().getInvoiceById(id);
  if (!invoice) {
    return { ok: false, reason: "請求書が見つかりません" };
  }

  if (isSupabaseConfigured()) {
    const ok = await dbDeleteInvoice(id);
    if (ok) {
      useInvoiceStore.getState().removeInvoice(id);
      await appendInvoiceDeletedHistory(invoice.projectId, invoice.invoiceNumber);
      await syncProjectAfterInvoiceRemovalDb(invoice.projectId, id);
      await reloadProjectsToStore();
    }
    return ok ? { ok: true } : { ok: false, reason: "請求書の削除に失敗しました" };
  }

  const ok = useInvoiceStore.getState().deleteInvoice(id);
  if (ok) {
    await appendInvoiceDeletedHistory(invoice.projectId, invoice.invoiceNumber);
    syncProjectAfterInvoiceRemoval(invoice.projectId, id);
  }
  return ok ? { ok: true } : { ok: false, reason: "請求書の削除に失敗しました" };
}

export async function cancelInvoice(
  id: string
): Promise<{ ok: true; invoice: InvoiceRecord } | { ok: false; reason: string }> {
  const blockReason = getInvoiceCancelBlockReason(id);
  if (blockReason) {
    return { ok: false, reason: blockReason };
  }

  const updated = await updateInvoiceStatus(id, "cancelled");
  if (!updated) {
    return { ok: false, reason: "請求書のキャンセルに失敗しました" };
  }
  return { ok: true, invoice: updated };
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceDocumentStatus
): Promise<InvoiceRecord | null> {
  if (status === "cancelled") {
    const blockReason = getInvoiceCancelBlockReason(id);
    if (blockReason) {
      return null;
    }
  }

  if (isSupabaseConfigured()) {
    const invoice = await dbUpdateInvoiceStatus(id, status);
    if (invoice) {
      useInvoiceStore.getState().mergeInvoice(
        invoice,
        useInvoiceStore.getState().getInvoiceItems(id)
      );
    }
    await reloadProjectsToStore();
    return invoice;
  }
  return useInvoiceStore.getState().updateInvoiceStatus(id, status);
}

export function invoiceInputFromForm(values: InvoiceFormValues): InvoiceInput {
  return {
    projectId: values.projectId,
    customerId: values.customerId,
    quoteId: values.quoteId,
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    paymentTerms: values.paymentTerms.trim(),
    bankAccountId:
      values.bankAccountId && values.bankAccountId.trim()
        ? values.bankAccountId
        : null,
    memo: values.memo.trim(),
    items: values.items.map((i, idx) => ({
      quoteItemId: i.quoteItemId,
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

export async function refreshOverdueInvoices(): Promise<void> {
  if (isSupabaseConfigured()) {
    await dbRefreshOverdueInvoices();
    await reloadInvoicesToStore();
    await reloadProjectsToStore();
  } else {
    useInvoiceStore.getState().refreshOverdueInvoices();
  }
}

export async function createInvoiceFromQuote(
  projectId: string,
  issueDate: string,
  dueDate: string
) {
  const quoteStore = useQuoteStore.getState();
  const candidates = quoteStore
    .getQuotesByProjectId(projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const quote =
    candidates.find((q) => q.status === "accepted") ??
    candidates.find((q) => q.status === "sent") ??
    candidates.find((q) => q.status === "draft") ??
    null;
  if (!quote) return null;

  let quoteItems = quoteStore.getQuoteItems(quote.id);
  const project = useProjectStore.getState().getProjectById(projectId);

  if (quoteItems.length === 0 && project) {
    try {
      await syncQuoteItemsFromProject(quote, project);
      quoteItems = quoteStore.getQuoteItems(quote.id);
    } catch {
      /* 見積同期に失敗しても案件明細から請求書を作成する */
    }
  }

  const invoiceItemInputs =
    quoteItems.length > 0
      ? quoteItems.map((it, idx) => ({
          quoteItemId: it.id,
          name: it.name,
          description: it.description,
          width: it.width ?? "",
          height: it.height ?? "",
          quantity: it.quantity,
          unit: normalizeUnit(it.unit),
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          sortOrder: it.sortOrder ?? idx,
        }))
      : project
        ? buildInvoiceInputItemsForProject(
            projectId,
            project.projectName,
            project.amount ?? 0
          )
        : [];

  if (invoiceItemInputs.length === 0) return null;

  const settings = useCompanySettingsStore.getState().settings;
  const input: InvoiceInput = {
    projectId,
    customerId: quote.customerId,
    quoteId: quote.id,
    issueDate,
    dueDate,
    paymentTerms:
      quote.paymentTerms?.trim() || settings.paymentTerms?.trim() || "",
    bankAccountId: null,
    memo: settings.invoiceMemoTemplate ?? "",
    items: invoiceItemInputs,
  };

  const invoice = await createInvoice(input);
  return { invoice, sourceQuote: quote };
}
