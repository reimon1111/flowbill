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
  addDays,
  todayISO,
} from "@/lib/recurring-utils";
import { useRecurringStore } from "@/stores/recurring-store";
import { useProjectStore } from "@/stores/project-store";
import { createInvoice, updateInvoiceStatus } from "@/lib/services/invoices";
import { createProject, syncCustomerProjectCounts } from "@/lib/services/projects";
import { createQuote, updateQuoteStatus } from "@/lib/services/quotes";
import { calculateQuoteExpiryDate } from "@/lib/quote-expiry";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbAdvanceRecurringAfterInvoice,
  dbInsertRecurring,
  dbUpdateRecurring,
  dbUpdateRecurringStatus,
} from "@/lib/db/write-recurring";

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

  const { project } = await createProject({
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
    discountLabel: "",
    discountAmount: 0,
    customerContactName: "",
    customerDepartment: "",
    customerPosition: "",
    items: [],
  });
  return project.id;
}

/**
 * 定期請求から請求書を生成する。
 * 案件・見積がなければ自動作成し、請求書は発行済みで作成する。
 */
export async function createInvoiceFromRecurring(
  recurringBillingId: string
): Promise<{ invoice: InvoiceRecord; projectId: string } | null> {
  const recurringStore = useRecurringStore.getState();
  const recurring = recurringStore.getRecurringById(recurringBillingId);
  if (!recurring || recurring.status !== "active") return null;

  const items = recurringStore.getRecurringItems(recurringBillingId);
  if (items.length === 0) return null;

  const projectId = await findOrCreateRecurringProject(
    recurring.customerId,
    recurring.title,
    recurring.totalAmount
  );

  const issueDate = todayISO();
  const dueDate = addDays(issueDate, 30);
  const expiryType = "2_weeks";
  const expiryDate = calculateQuoteExpiryDate(issueDate, expiryType);
  const settings = useCompanySettingsStore.getState().settings;

  const quote = await createQuote({
    projectId,
    customerId: recurring.customerId,
    issueDate,
    expiryType,
    expiryDate,
    paymentTerms: settings.paymentTerms ?? "",
    memo: recurring.memo ? `定期請求: ${recurring.memo}` : `定期請求: ${recurring.title}`,
    discountLabel: recurring.discountLabel ?? "",
    discountAmount: recurring.discountAmount ?? 0,
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
      unit: "一式",
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      sortOrder: it.sortOrder ?? idx,
    })),
  });
  await updateQuoteStatus(quote.id, "accepted");

  const { getQuoteItems } = await import("@/lib/services/quotes");
  const qItems = await getQuoteItems(quote.id);

  const invoice = await createInvoice({
    projectId,
    customerId: recurring.customerId,
    quoteId: quote.id,
    issueDate,
    dueDate,
    paymentTerms: quote.paymentTerms || settings.paymentTerms || "",
    bankAccountId: null,
    memo: recurring.memo,
    discountLabel: recurring.discountLabel ?? "",
    discountAmount: recurring.discountAmount ?? 0,
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
      unit: it.unit || "一式",
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      sortOrder: it.sortOrder ?? idx,
    })),
  });

  await updateInvoiceStatus(invoice.id, "issued");

  if (isSupabaseConfigured()) {
    const advanced = await dbAdvanceRecurringAfterInvoice(recurringBillingId);
    if (advanced) {
      useRecurringStore.getState().mergeRecurring(
        advanced,
        useRecurringStore.getState().getRecurringItems(recurringBillingId)
      );
    }
  } else {
    recurringStore.advanceAfterInvoice(recurringBillingId);
  }

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
