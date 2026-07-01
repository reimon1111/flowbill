import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import {
  companyFromRow,
  customerFromRow,
  invoiceFromRow,
  invoiceItemFromRow,
  itemTemplateFromRow,
  projectFromRow,
  projectHistoryFromRow,
  projectItemFromRow,
  quoteFromRow,
  quoteItemFromRow,
  recurringFromRow,
  recurringItemFromRow,
  type CompanyRow,
  type CustomerRow,
  type InvoiceItemRow,
  type InvoiceRow,
  type ItemTemplateRow,
  type ProjectHistoryRow,
  type ProjectItemRow,
  type ProjectRow,
  type QuoteItemRow,
  type QuoteRow,
  type RecurringBillingItemRow,
  type RecurringBillingRow,
} from "@/lib/db/mappers";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useItemTemplateCategoryStore } from "@/stores/item-template-category-store";
import { useProjectStore } from "@/stores/project-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useRecurringStore } from "@/stores/recurring-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";
import { isMissingItemTemplateCategoriesTable, isMissingProjectItemsTable, isMissingDocumentManagementTables } from "@/lib/db/errors";
import { useAppDataStore } from "@/stores/app-data-store";
import { buildMigrationBanner } from "@/lib/db/migration-warnings";
import {
  itemTemplateCategoryFromRow,
  type ItemTemplateCategoryRow,
} from "@/lib/db/mappers";
import {
  bankAccountFromRow,
  deliveryNoteFromRow,
  deliveryNoteItemFromRow,
  orderFromRow,
  orderItemFromRow,
  receiptFromRow,
  receiptItemFromRow,
  type BankAccountRow,
  type DeliveryNoteItemRow,
  type DeliveryNoteRow,
  type OrderItemRow,
  type OrderRow,
  type ReceiptItemRow,
  type ReceiptRow,
} from "@/lib/db/commercial-mappers";
import {
  collectProjectIdsFromDocuments,
  fetchSupplementalProjects,
} from "@/lib/db/load-project-supplement";
import type { ProjectRecord } from "@/lib/types";

export async function loadAllDataFromSupabase(): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();

  const [
    companyRes,
    customersRes,
    templatesRes,
    templateCategoriesRes,
    projectsRes,
    historiesRes,
    projectItemsRes,
    quotesRes,
    quoteItemsRes,
    invoicesRes,
    invoiceItemsRes,
    recurringRes,
    recurringItemsRes,
  ] = await Promise.all([
    supabase.from("companies").select("*").eq("id", companyId).single(),
    supabase
      .from("customers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("item_templates")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("item_template_categories")
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("projects")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_histories")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_items")
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quotes")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("quote_items").select("*").eq("company_id", companyId),
    supabase
      .from("invoices")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("invoice_items").select("*").eq("company_id", companyId),
    supabase
      .from("recurring_billings")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("recurring_billing_items")
      .select("*")
      .eq("company_id", companyId),
  ]);

  const projectItemsMissing =
    projectItemsRes.error != null &&
    isMissingProjectItemsTable(projectItemsRes.error);

  const templateCategoriesMissing =
    templateCategoriesRes.error != null &&
    isMissingItemTemplateCategoriesTable(templateCategoriesRes.error);

  const pendingMigrations: string[] = [];
  if (projectItemsMissing) {
    pendingMigrations.push("add-project-items.sql（案件明細）");
  }
  if (templateCategoriesMissing) {
    pendingMigrations.push("add-item-template-categories.sql（カテゴリ管理）");
  }

  const firstError =
    companyRes.error ??
    customersRes.error ??
    templatesRes.error ??
    (templateCategoriesMissing ? null : templateCategoriesRes.error) ??
    projectsRes.error ??
    historiesRes.error ??
    (projectItemsMissing ? null : projectItemsRes.error) ??
    quotesRes.error ??
    quoteItemsRes.error ??
    invoicesRes.error ??
    invoiceItemsRes.error ??
    recurringRes.error ??
    recurringItemsRes.error;

  if (firstError) throw firstError;

  const quotes = (quotesRes.data as QuoteRow[]).map(quoteFromRow);
  const invoices = (invoicesRes.data as InvoiceRow[]).map(invoiceFromRow);
  let projects: ProjectRecord[] = (projectsRes.data as ProjectRow[]).map(
    projectFromRow
  );

  projects = await fetchSupplementalProjects(
    companyId,
    projects,
    collectProjectIdsFromDocuments(quotes, invoices)
  );

  if (companyRes.data) {
    useCompanySettingsStore
      .getState()
      .hydrate(companyFromRow(companyRes.data as CompanyRow));
  }

  useCustomerStore
    .getState()
    .hydrate((customersRes.data as CustomerRow[]).map(customerFromRow));

  useItemTemplateStore
    .getState()
    .hydrate((templatesRes.data as ItemTemplateRow[]).map(itemTemplateFromRow));

  // カテゴリマスタ（未適用でもテンプレのカテゴリ文字列で運用可能）
  if (!templateCategoriesRes.error) {
    const categories = (templateCategoriesRes.data as ItemTemplateCategoryRow[]).map(
      itemTemplateCategoryFromRow
    );
    if (categories.length > 0) {
      useItemTemplateCategoryStore.getState().hydrate(categories);
    }
  }

  useProjectStore.getState().hydrate({
    projects,
    histories: (historiesRes.data as ProjectHistoryRow[]).map(projectHistoryFromRow),
  });

  useProjectItemStore.getState().hydrate(
    projectItemsMissing
      ? []
      : (projectItemsRes.data as ProjectItemRow[]).map(projectItemFromRow)
  );

  useQuoteStore.getState().hydrate({
    quotes,
    quoteItems: (quoteItemsRes.data as QuoteItemRow[]).map(quoteItemFromRow),
  });

  useInvoiceStore.getState().hydrate({
    invoices,
    invoiceItems: (invoiceItemsRes.data as InvoiceItemRow[]).map(invoiceItemFromRow),
  });

  useRecurringStore.getState().hydrate({
    recurringBillings: (recurringRes.data as RecurringBillingRow[]).map(recurringFromRow),
    recurringBillingItems: (recurringItemsRes.data as RecurringBillingItemRow[]).map(
      recurringItemFromRow
    ),
  });

  const [
    bankAccountsRes,
    ordersRes,
    orderItemsRes,
    deliveryNotesRes,
    deliveryNoteItemsRes,
    receiptsRes,
    receiptItemsRes,
  ] = await Promise.all([
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("order_items").select("*").eq("company_id", companyId),
    supabase
      .from("delivery_notes")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_note_items")
      .select("*")
      .eq("company_id", companyId),
    supabase
      .from("receipts")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("receipt_items").select("*").eq("company_id", companyId),
  ]);

  const documentManagementMissing =
    [ordersRes, orderItemsRes, deliveryNotesRes, deliveryNoteItemsRes, receiptsRes, receiptItemsRes].some(
      (res) => res.error != null && isMissingDocumentManagementTables(res.error)
    );

  const bankAccountsMissing =
    bankAccountsRes.error != null &&
    isMissingDocumentManagementTables(bankAccountsRes.error);

  if (!bankAccountsMissing && !bankAccountsRes.error && bankAccountsRes.data) {
    useBankAccountStore
      .getState()
      .hydrate((bankAccountsRes.data as BankAccountRow[]).map(bankAccountFromRow));
  }

  if (documentManagementMissing || bankAccountsMissing) {
    pendingMigrations.push("add-document-management.sql（注文書・納品書・領収書・複数口座）");
  }

  if (pendingMigrations.length > 0) {
    useAppDataStore.getState().setMigrationWarning(
      buildMigrationBanner(`未適用: ${pendingMigrations.join("、")}。`)
    );
  } else {
    useAppDataStore.getState().setMigrationWarning(null);
  }

  if (!documentManagementMissing) {
    if (!ordersRes.error && !orderItemsRes.error) {
      useOrderStore.getState().hydrate({
        orders: (ordersRes.data as OrderRow[]).map(orderFromRow),
        orderItems: (orderItemsRes.data as OrderItemRow[]).map(orderItemFromRow),
      });
    }
    if (!deliveryNotesRes.error && !deliveryNoteItemsRes.error) {
      useDeliveryNoteStore.getState().hydrate({
        deliveryNotes: (deliveryNotesRes.data as DeliveryNoteRow[]).map(deliveryNoteFromRow),
        deliveryNoteItems: (deliveryNoteItemsRes.data as DeliveryNoteItemRow[]).map(
          deliveryNoteItemFromRow
        ),
      });
    }
    if (!receiptsRes.error && !receiptItemsRes.error) {
      useReceiptStore.getState().hydrate({
        receipts: (receiptsRes.data as ReceiptRow[]).map(receiptFromRow),
        receiptItems: (receiptItemsRes.data as ReceiptItemRow[]).map(receiptItemFromRow),
      });
    }
  }

  const projectStore = useProjectStore.getState();
  const supplementalIds = collectProjectIdsFromDocuments(
    useQuoteStore.getState().quotes,
    useInvoiceStore.getState().invoices,
    useOrderStore.getState().orders,
    useDeliveryNoteStore.getState().deliveryNotes,
    useReceiptStore.getState().receipts
  );
  const mergedProjects = await fetchSupplementalProjects(
    companyId,
    projectStore.projects,
    supplementalIds
  );
  if (mergedProjects.length !== projectStore.projects.length) {
    useProjectStore.getState().hydrate({
      projects: mergedProjects,
      histories: projectStore.histories,
    });
  }

  useAppDataStore.getState().setLoadedCompanyId(companyId);
}

export async function reloadInvoicesToStore(): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const [invoicesRes, invoiceItemsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase.from("invoice_items").select("*").eq("company_id", companyId),
  ]);
  if (invoicesRes.error) throw invoicesRes.error;
  if (invoiceItemsRes.error) throw invoiceItemsRes.error;

  useInvoiceStore.getState().hydrate({
    invoices: (invoicesRes.data as InvoiceRow[]).map(invoiceFromRow),
    invoiceItems: (invoiceItemsRes.data as InvoiceItemRow[]).map(invoiceItemFromRow),
  });
}

export async function reloadProjectsToStore(): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const [projectsRes, historiesRes, projectItemsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_histories")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_items")
      .select("*")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true }),
  ]);
  if (projectsRes.error) throw projectsRes.error;
  if (historiesRes.error) throw historiesRes.error;

  const projectItemsMissing =
    projectItemsRes.error != null &&
    isMissingProjectItemsTable(projectItemsRes.error);
  if (projectItemsRes.error && !projectItemsMissing) throw projectItemsRes.error;

  let projects: ProjectRecord[] = (projectsRes.data as ProjectRow[]).map(
    projectFromRow
  );
  projects = await fetchSupplementalProjects(
    companyId,
    projects,
    collectProjectIdsFromDocuments(
      useQuoteStore.getState().quotes,
      useInvoiceStore.getState().invoices,
      useOrderStore.getState().orders,
      useDeliveryNoteStore.getState().deliveryNotes,
      useReceiptStore.getState().receipts
    )
  );

  useProjectStore.getState().hydrate({
    projects,
    histories: (historiesRes.data as ProjectHistoryRow[]).map(projectHistoryFromRow),
  });

  useProjectItemStore.getState().hydrate(
    projectItemsMissing
      ? []
      : (projectItemsRes.data as ProjectItemRow[]).map(projectItemFromRow)
  );
}

/** 単一案件のみ再取得（全件 reload より軽量） */
export async function reloadSingleProjectToStore(projectId: string): Promise<void> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();

  const [projectRes, historiesRes, itemsRes] = await Promise.all([
    supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .eq("company_id", companyId)
      .single(),
    supabase
      .from("project_histories")
      .select("*")
      .eq("project_id", projectId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    supabase
      .from("project_items")
      .select("*")
      .eq("project_id", projectId)
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true }),
  ]);

  if (projectRes.error || !projectRes.data) return;
  if (historiesRes.error) throw historiesRes.error;

  const projectItemsMissing =
    itemsRes.error != null && isMissingProjectItemsTable(itemsRes.error);
  if (itemsRes.error && !projectItemsMissing) throw itemsRes.error;

  const project = projectFromRow(projectRes.data as ProjectRow);
  const store = useProjectStore.getState();
  store.upsertProject(project);
  store.hydrate({
    projects: store.projects,
    histories: [
      ...(historiesRes.data as ProjectHistoryRow[]).map(projectHistoryFromRow),
      ...store.histories.filter((h) => h.projectId !== projectId),
    ],
  });

  const itemStore = useProjectItemStore.getState();
  const nextItems = projectItemsMissing
    ? itemStore.projectItems.filter((i) => i.projectId !== projectId)
    : [
        ...(itemsRes.data as ProjectItemRow[]).map(projectItemFromRow),
        ...itemStore.projectItems.filter((i) => i.projectId !== projectId),
      ];
  itemStore.hydrate(nextItems);
}
