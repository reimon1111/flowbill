import type {
  CreateInvoiceOptions,
  InvoiceInput,
  InvoiceItemRecord,
  InvoiceListItem,
  InvoiceRecord,
  InvoiceDocumentStatus,
  QuoteRecord,
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
  dbSoftDeleteInvoice,
  dbUpdateInvoice,
  dbUpdateInvoiceStatus,
} from "@/lib/db/write-invoices";
import { dbInsertHistory, dbUpsertProject } from "@/lib/db/write-projects";
import { reloadInvoicesToStore, reloadSingleProjectToStore } from "@/lib/db/load-all";
import { syncStoresAfterInvoiceChange } from "@/lib/invoice-store-sync";
import { dbRefreshOverdueInvoices } from "@/lib/db/write-invoices";
import { resolveProjectFieldsAfterInvoiceChange } from "@/lib/invoice-project-sync";
import {
  getActiveInvoicesForProject,
  getPrimaryProjectInvoice,
} from "@/lib/invoice-filters";
import { normalizeUnit } from "@/lib/constants/units";
import { resolveInheritedDiscount } from "@/lib/discount-totals";
import { pickCounterpartyContact } from "@/lib/counterparty-contact";
import { pickCustomerHonorific } from "@/lib/customer-honorific";
import { buildInvoiceInputItemsForProject } from "@/lib/services/project-items";
import { syncQuoteItemsFromProject } from "@/lib/services/quotes";
import {
  logSupabaseError,
  toPaymentStatusUpdateError,
} from "@/lib/db/errors";
import { assertCanWriteBusinessData } from "@/lib/guards/write-access";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { canManageMembers } from "@/lib/types/company-membership";
import { ensureReceiptForInvoice } from "@/lib/services/commercial-documents";

export const INVOICE_SOFT_DELETE_DENIED_MESSAGE =
  "請求書の削除はオーナーまたは管理者のみ可能です。";

export const INVOICE_DUPLICATE_BLOCKED_MESSAGE =
  "この案件にはすでに有効な請求書があります。追加請求書は「追加請求書を作成」から作成してください。";

export function getActiveInvoicesForProjectId(projectId: string): InvoiceRecord[] {
  return getActiveInvoicesForProject(
    useInvoiceStore.getState().getInvoices(),
    projectId
  );
}

export function getPrimaryInvoiceForProjectId(
  projectId: string
): InvoiceRecord | null {
  return getPrimaryProjectInvoice(
    useInvoiceStore.getState().getInvoices(),
    projectId
  );
}

function assertCanSoftDeleteInvoice(): void {
  const role = useCompanyMembershipStore.getState().currentRole;
  if (!canManageMembers(role)) {
    throw new Error(INVOICE_SOFT_DELETE_DENIED_MESSAGE);
  }
}

export function canSoftDeleteInvoice(): boolean {
  const role = useCompanyMembershipStore.getState().currentRole;
  return canManageMembers(role);
}

export const INVOICE_CANCEL_BLOCKED_PAID_MESSAGE =
  "入金済みの請求書はキャンセルできません。";

export function getInvoiceDeletionBlockReason(invoiceId: string): string | null {
  const invoice = useInvoiceStore.getState().getInvoiceById(invoiceId);
  if (!invoice) return "請求書が見つかりません";
  if (invoice.deletedAt) return "すでに削除済みです。";
  if (invoice.status === "paid") {
    return "入金済みの請求書は削除できません。";
  }
  if (invoice.status === "draft") {
    return null;
  }
  if (!canSoftDeleteInvoice()) {
    return INVOICE_SOFT_DELETE_DENIED_MESSAGE;
  }
  return null;
}

export const INVOICE_DELETE_BLOCKED_MESSAGE =
  "この請求書は削除できません。必要な場合はキャンセルしてください。";

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
  invoiceNumber: string,
  draft: boolean
) {
  const payload = {
    projectId,
    type: "updated" as const,
    title: draft ? "請求書（下書き）を削除しました" : "請求書を削除しました",
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
  return getActiveInvoicesForProject(
    useInvoiceStore.getState().invoices,
    projectId
  );
}

export async function createInvoice(
  input: InvoiceInput,
  options?: CreateInvoiceOptions
): Promise<InvoiceRecord> {
  assertCanWriteBusinessData();
  const existing = getPrimaryInvoiceForProjectId(input.projectId);
  if (existing && !options?.allowAdditional) {
    return existing;
  }

  const bankAccountId = await resolveBankAccountIdForInvoice(input.bankAccountId);
  const payload = { ...input, bankAccountId };

  if (isSupabaseConfigured()) {
    const { invoice, items } = await dbInsertInvoice(payload);
    useInvoiceStore.getState().mergeInvoice(invoice, items);
    await reloadSingleProjectToStore(input.projectId);
    return invoice;
  }
  return useInvoiceStore.getState().createInvoice(payload);
}

export async function updateInvoice(id: string, input: InvoiceInput): Promise<InvoiceRecord | null> {
  assertCanWriteBusinessData();
  const bankAccountId = await resolveBankAccountIdForInvoice(input.bankAccountId);
  const payload = { ...input, bankAccountId };

  if (isSupabaseConfigured()) {
    const result = await dbUpdateInvoice(id, payload);
    if (result) {
      useInvoiceStore.getState().mergeInvoice(result.invoice, result.items);
      await reloadSingleProjectToStore(result.invoice.projectId);
    }
    return result?.invoice ?? null;
  }
  return useInvoiceStore.getState().updateInvoice(id, payload);
}

export async function deleteInvoice(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  assertCanWriteBusinessData();
  const blockReason = getInvoiceDeletionBlockReason(id);
  if (blockReason) {
    return { ok: false, reason: blockReason };
  }

  const invoice = useInvoiceStore.getState().getInvoiceById(id);
  if (!invoice) {
    return { ok: false, reason: "請求書が見つかりません" };
  }

  const isDraft = invoice.status === "draft";

  if (isSupabaseConfigured()) {
    if (isDraft) {
      const ok = await dbDeleteInvoice(id);
      if (ok) {
        useInvoiceStore.getState().removeInvoice(id);
        await appendInvoiceDeletedHistory(invoice.projectId, invoice.invoiceNumber, true);
        await syncProjectAfterInvoiceRemovalDb(invoice.projectId, id);
        await reloadSingleProjectToStore(invoice.projectId);
      }
      return ok ? { ok: true } : { ok: false, reason: "請求書の削除に失敗しました" };
    }

    try {
      assertCanSoftDeleteInvoice();
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : INVOICE_SOFT_DELETE_DENIED_MESSAGE,
      };
    }

    const softDeleted = await dbSoftDeleteInvoice(id);
    if (softDeleted) {
      useInvoiceStore.getState().removeInvoice(id);
      await reloadSingleProjectToStore(invoice.projectId);
    }
    return softDeleted
      ? { ok: true }
      : { ok: false, reason: "請求書の削除に失敗しました" };
  }

  if (isDraft) {
    const ok = useInvoiceStore.getState().deleteInvoice(id);
    if (ok) {
      await appendInvoiceDeletedHistory(invoice.projectId, invoice.invoiceNumber, true);
      syncProjectAfterInvoiceRemoval(invoice.projectId, id);
    }
    return ok ? { ok: true } : { ok: false, reason: "請求書の削除に失敗しました" };
  }

  try {
    assertCanSoftDeleteInvoice();
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : INVOICE_SOFT_DELETE_DENIED_MESSAGE,
    };
  }

  const softDeleted = useInvoiceStore.getState().softDeleteInvoice(id);
  if (softDeleted) {
    await appendInvoiceDeletedHistory(invoice.projectId, invoice.invoiceNumber, false);
  }
  return softDeleted
    ? { ok: true }
    : { ok: false, reason: "請求書の削除に失敗しました" };
}

export async function cancelInvoice(
  id: string
): Promise<{ ok: true; invoice: InvoiceRecord } | { ok: false; reason: string }> {
  assertCanWriteBusinessData();
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
  assertCanWriteBusinessData();
  if (status === "cancelled") {
    const blockReason = getInvoiceCancelBlockReason(id);
    if (blockReason) {
      return null;
    }
  }

  try {
    if (isSupabaseConfigured()) {
      const invoice = await dbUpdateInvoiceStatus(id, status);
      if (!invoice) return null;
      syncStoresAfterInvoiceChange(invoice);
      void reloadSingleProjectToStore(invoice.projectId).catch((error) => {
        logSupabaseError("reloadSingleProjectToStore", error);
      });
      if (status === "issued") {
        await ensureReceiptForInvoice(invoice.id);
      }
      return invoice;
    }

    const existing = useInvoiceStore.getState().getInvoiceById(id);
    if (!existing) return null;
    const updated: InvoiceRecord = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    syncStoresAfterInvoiceChange(updated);

    const projects = useProjectStore.getState();
    if (status === "issued") {
      projects.addHistory({
        projectId: updated.projectId,
        type: "invoice_generated",
        title: "請求書を発行済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "sent") {
      projects.addHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書を送付済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "paid") {
      projects.addHistory({
        projectId: updated.projectId,
        type: "payment_received",
        title: "入金済みにしました",
        description: updated.invoiceNumber,
      });
    }
    if (status === "cancelled") {
      projects.addHistory({
        projectId: updated.projectId,
        type: "updated",
        title: "請求書をキャンセルしました",
        description: updated.invoiceNumber,
      });
    }

    if (status === "issued") {
      await ensureReceiptForInvoice(updated.id);
    }
    return updated;
  } catch (error) {
    logSupabaseError("updateInvoiceStatus", error);
    throw toPaymentStatusUpdateError(error);
  }
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
    discountLabel: values.discountLabel.trim(),
    discountAmount: values.discountAmount ?? 0,
    customerHonorific: values.customerHonorific,
    customerContactName: values.customerContactName.trim(),
    customerDepartment: values.customerDepartment.trim(),
    customerPosition: values.customerPosition.trim(),
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
    const changed = await dbRefreshOverdueInvoices();
    if (changed) {
      await reloadInvoicesToStore();
    }
  } else {
    useInvoiceStore.getState().refreshOverdueInvoices();
  }
}

export async function createInvoiceFromQuote(
  projectId: string,
  issueDate: string,
  dueDate: string,
  options?: CreateInvoiceOptions
) {
  assertCanWriteBusinessData();
  const existing = getPrimaryInvoiceForProjectId(projectId);
  if (existing && !options?.allowAdditional) {
    return { invoice: existing, sourceQuote: null as QuoteRecord | null };
  }
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
  const inheritedDiscount = resolveInheritedDiscount(quote, project);
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
    discountLabel: inheritedDiscount.discountLabel,
    discountAmount: inheritedDiscount.discountAmount,
    customerHonorific: pickCustomerHonorific(quote),
    ...pickCounterpartyContact(
      (quote.customerContactName?.trim() || quote.customerDepartment?.trim() || quote.customerPosition?.trim())
        ? quote
        : project
    ),
    items: invoiceItemInputs,
  };

  const invoice = await createInvoice(input, options);
  return { invoice, sourceQuote: quote };
}
