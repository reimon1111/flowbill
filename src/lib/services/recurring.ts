import type {
  InvoiceRecord,
  RecurringBillingInput,
  RecurringBillingItemRecord,
  RecurringBillingListItem,
  RecurringBillingRecord,
  RecurringBillingStatus,
} from "@/lib/types";
import type { RecurringFormValues } from "@/lib/validations/recurring";
import {
  RECURRING_PROJECT_PREFIX,
  todayISO,
} from "@/lib/recurring-utils";
import { useRecurringStore } from "@/stores/recurring-store";
import { useProjectStore } from "@/stores/project-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import {
  createInvoice,
  updateInvoiceStatus,
} from "@/lib/services/invoices";
import { createProject, syncCustomerProjectCounts } from "@/lib/services/projects";
import {
  createQuote,
  deleteQuote,
  updateQuoteStatus,
} from "@/lib/services/quotes";
import { calculateQuoteExpiryDate } from "@/lib/quote-expiry";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { resolveInitialDocumentContactForCreate } from "@/lib/services/user-profile-settings";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbAdvanceRecurringAfterInvoice,
  dbFindActiveRecurringOccurrenceInvoice,
  dbInsertRecurring,
  dbUpdateRecurring,
  dbUpdateRecurringStatus,
} from "@/lib/db/write-recurring";
import { isRecurringOccurrenceConflictError } from "@/lib/db/errors";

export async function getRecurringBillings(): Promise<RecurringBillingListItem[]> {
  return useRecurringStore.getState().getListItems();
}

export async function getRecurringById(
  id: string
): Promise<RecurringBillingRecord | null> {
  return useRecurringStore.getState().getRecurringById(id) ?? null;
}

export async function getRecurringItems(
  recurringBillingId: string
): Promise<RecurringBillingItemRecord[]> {
  return useRecurringStore.getState().getRecurringItems(recurringBillingId);
}

export async function createRecurring(
  input: RecurringBillingInput
): Promise<RecurringBillingRecord> {
  if (isSupabaseConfigured()) {
    const { billing, items } = await dbInsertRecurring(input);
    useRecurringStore.getState().mergeRecurring(billing, items);
    return billing;
  }
  return useRecurringStore.getState().createRecurring(input);
}

export async function updateRecurring(
  id: string,
  input: RecurringBillingInput
): Promise<RecurringBillingRecord | null> {
  if (isSupabaseConfigured()) {
    const result = await dbUpdateRecurring(id, input);
    if (result) useRecurringStore.getState().mergeRecurring(result.billing, result.items);
    return result?.billing ?? null;
  }
  return useRecurringStore.getState().updateRecurring(id, input);
}

export async function updateRecurringStatus(
  id: string,
  status: RecurringBillingStatus
): Promise<RecurringBillingRecord | null> {
  if (isSupabaseConfigured()) {
    const billing = await dbUpdateRecurringStatus(id, status);
    if (billing) {
      useRecurringStore.getState().mergeRecurring(
        billing,
        useRecurringStore.getState().getRecurringItems(id)
      );
    }
    return billing;
  }
  return useRecurringStore.getState().updateRecurringStatus(id, status);
}

export function recurringInputFromForm(values: RecurringFormValues): RecurringBillingInput {
  return {
    customerId: values.customerId,
    title: values.title.trim(),
    billingDay: values.billingDay,
    nextBillingDate: values.nextBillingDate,
    memo: values.memo.trim(),
    items: values.items.map((i, idx) => ({
      itemTemplateId: i.itemTemplateId,
      name: i.name.trim(),
      description: i.description.trim(),
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      taxRate: i.taxRate,
      sortOrder: i.sortOrder ?? idx,
    })),
  };
}

async function findOrCreateRecurringProject(
  customerId: string,
  title: string,
  amount: number
): Promise<string> {
  const projectName = `${RECURRING_PROJECT_PREFIX}${title}`;
  const existing = useProjectStore.getState().projects.find(
    (p) => p.customerId === customerId && p.projectName === projectName
  );
  if (existing) return existing.id;

  const { project } = await createProject(
    {
      customerId,
      projectName,
      constructionSite: "",
      status: "completed",
      amount,
      dueDate: "",
      startDate: "",
      endDate: "",
      assigneeName: "",
      memo: "定期請求から自動作成された案件",
      documentMemo: "",
      discountLabel: "",
      discountAmount: 0,
      customerHonorific: "御中",
      customerContactName: "",
      customerDepartment: "",
      customerPosition: "",
      items: [],
    },
    {
      workflowMode: "standard",
      provisionSimpleDocuments: false,
    }
  );
  return project.id;
}

function findLocalRecurringOccurrenceInvoice(
  recurringBillingId: string,
  occurrenceDate: string
): InvoiceRecord | null {
  return (
    useInvoiceStore
      .getState()
      .invoices.find(
        (inv) =>
          !inv.deletedAt &&
          inv.recurringBillingId === recurringBillingId &&
          inv.recurringOccurrenceDate === occurrenceDate
      ) ?? null
  );
}

async function findRecurringOccurrenceInvoice(
  recurringBillingId: string,
  occurrenceDate: string
): Promise<InvoiceRecord | null> {
  if (isSupabaseConfigured()) {
    const fromDb = await dbFindActiveRecurringOccurrenceInvoice(
      recurringBillingId,
      occurrenceDate
    );
    if (fromDb) {
      const existingItems = useInvoiceStore
        .getState()
        .getInvoiceItems(fromDb.id);
      useInvoiceStore.getState().mergeInvoice(fromDb, existingItems);
      return fromDb;
    }
  }
  return findLocalRecurringOccurrenceInvoice(recurringBillingId, occurrenceDate);
}

async function advanceRecurringOccurrence(
  recurringBillingId: string,
  occurrenceDate: string
): Promise<void> {
  if (isSupabaseConfigured()) {
    const advanced = await dbAdvanceRecurringAfterInvoice(
      recurringBillingId,
      occurrenceDate
    );
    if (advanced) {
      useRecurringStore.getState().mergeRecurring(
        advanced,
        useRecurringStore.getState().getRecurringItems(recurringBillingId)
      );
    }
    return;
  }
  useRecurringStore
    .getState()
    .advanceAfterInvoice(recurringBillingId, occurrenceDate);
}

async function ensureInvoiceIssued(invoice: InvoiceRecord): Promise<InvoiceRecord> {
  if (invoice.status === "issued" || invoice.status === "sent" || invoice.status === "paid") {
    return invoice;
  }
  if (invoice.status === "cancelled" || invoice.deletedAt) {
    return invoice;
  }
  const updated = await updateInvoiceStatus(invoice.id, "issued");
  return updated ?? invoice;
}

/**
 * 定期請求から請求書を生成する。
 * 同一「定期請求 × 請求回（next_billing_date）」では invoice は最大1件。
 * next_billing_date も請求回あたり1回だけ進む。
 */
export async function createInvoiceFromRecurring(
  recurringBillingId: string
): Promise<{ invoice: InvoiceRecord; projectId: string } | null> {
  const recurringStore = useRecurringStore.getState();
  const recurring = recurringStore.getRecurringById(recurringBillingId);
  if (!recurring || recurring.status !== "active") return null;

  const items = recurringStore.getRecurringItems(recurringBillingId);
  if (items.length === 0) return null;

  // 請求回 = 生成開始時点の next_billing_date
  const occurrenceDate = recurring.nextBillingDate;

  const existingForOccurrence = await findRecurringOccurrenceInvoice(
    recurringBillingId,
    occurrenceDate
  );
  if (existingForOccurrence) {
    const projectId =
      existingForOccurrence.projectId ||
      (await findOrCreateRecurringProject(
        recurring.customerId,
        recurring.title,
        recurring.totalAmount
      ));
    const invoice = await ensureInvoiceIssued(existingForOccurrence);
    await advanceRecurringOccurrence(recurringBillingId, occurrenceDate);
    syncCustomerProjectCounts();
    return { invoice, projectId };
  }

  const projectId = await findOrCreateRecurringProject(
    recurring.customerId,
    recurring.title,
    recurring.totalAmount
  );

  const issueDate = todayISO();
  const expiryType = "2_weeks";
  const expiryDate = calculateQuoteExpiryDate(issueDate, expiryType);
  const settings = useCompanySettingsStore.getState().settings;

  const documentContact = await resolveInitialDocumentContactForCreate();
  const quote = await createQuote({
    projectId,
    customerId: recurring.customerId,
    issueDate,
    expiryType,
    expiryDate,
    paymentTerms: settings.paymentTerms ?? "",
    memo: recurring.memo ? `定期請求: ${recurring.memo}` : `定期請求: ${recurring.title}`,
    documentEmail: documentContact.email,
    documentContactName: documentContact.contactName,
    discountLabel: recurring.discountLabel ?? "",
    discountAmount: recurring.discountAmount ?? 0,
    customerHonorific: "御中",
    customerContactName: "",
    customerDepartment: "",
    customerPosition: "",
    items: items.map((it, idx) => ({
      itemTemplateId: it.itemTemplateId,
      name: it.name,
      description: it.description,
      width: "",
      height: "",
      quantity: it.quantity,
      unit: "式",
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      sortOrder: it.sortOrder ?? idx,
    })),
  });
  await updateQuoteStatus(quote.id, "accepted");

  const { getQuoteItems } = await import("@/lib/services/quotes");
  const qItems = await getQuoteItems(quote.id);

  // 定期は同一案件を再利用するため、追加請求として明示する。
  // allowAdditional なしだと createInvoice が既存請求を silent return し、
  // 2回目以降の生成が壊れ、かつ next_billing_date だけ進む。
  let invoice: InvoiceRecord;
  try {
    invoice = await createInvoice(
      {
        projectId,
        customerId: recurring.customerId,
        quoteId: quote.id,
        issueDate,
        dueDateMode: "discussion",
        dueDate: "",
        paymentTerms: quote.paymentTerms || settings.paymentTerms || "",
        bankAccountId: null,
        memo: recurring.memo,
        memoFontSize: "normal",
        documentEmail: documentContact.email,
        documentContactName: documentContact.contactName,
        discountLabel: recurring.discountLabel ?? "",
        discountAmount: recurring.discountAmount ?? 0,
        customerHonorific: "御中",
        customerContactName: "",
        customerDepartment: "",
        customerPosition: "",
        items: qItems.map((it, idx) => ({
          quoteItemId: it.id,
          name: it.name,
          description: it.description,
          width: it.width ?? "",
          height: it.height ?? "",
          quantity: it.quantity,
          unit: it.unit || "式",
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          sortOrder: it.sortOrder ?? idx,
        })),
        recurringBillingId,
        recurringOccurrenceDate: occurrenceDate,
      },
      { allowAdditional: true }
    );
  } catch (error) {
    if (!isRecurringOccurrenceConflictError(error)) throw error;

    // 並行勝者の invoice を返す。自前の見積は捨てる（可能な場合）
    try {
      await deleteQuote(quote.id);
    } catch {
      /* ignore orphan cleanup */
    }

    const winner = await findRecurringOccurrenceInvoice(
      recurringBillingId,
      occurrenceDate
    );
    if (!winner) throw error;

    invoice = await ensureInvoiceIssued(winner);
    await advanceRecurringOccurrence(recurringBillingId, occurrenceDate);
    syncCustomerProjectCounts();
    return { invoice, projectId: winner.projectId || projectId };
  }

  invoice = await ensureInvoiceIssued(invoice);
  await advanceRecurringOccurrence(recurringBillingId, occurrenceDate);
  syncCustomerProjectCounts();

  return { invoice, projectId };
}

export type RecurringDashboardStats = {
  upcomingCount: number;
  dueSoonCount: number;
  upcomingItems: Array<{
    id: string;
    title: string;
    customerName: string;
    nextBillingDate: string;
    totalAmount: number;
    daysUntil: number;
  }>;
};

export function getRecurringDashboardStats(): RecurringDashboardStats {
  const items = useRecurringStore
    .getState()
    .getListItems()
    .filter((r) => r.status === "active")
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  const now = new Date();
  const in30Days = new Date(now);
  in30Days.setDate(in30Days.getDate() + 30);

  const upcomingItems = items
    .map((r) => {
      const target = new Date(r.nextBillingDate + "T00:00:00");
      const daysUntil = Math.round(
        (target.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
          86400000
      );
      return {
        id: r.id,
        title: r.title,
        customerName: r.customerName,
        nextBillingDate: r.nextBillingDate,
        totalAmount: r.totalAmount,
        daysUntil,
      };
    })
    .slice(0, 6);

  const dueSoonCount = items.filter((r) => {
    const target = new Date(r.nextBillingDate + "T00:00:00");
    return target <= in30Days;
  }).length;

  return {
    upcomingCount: items.length,
    dueSoonCount,
    upcomingItems,
  };
}
