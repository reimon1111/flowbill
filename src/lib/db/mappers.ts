import {
  DEFAULT_QUOTE_EXPIRY_TYPE,
  expiryTypeToLegacyDays,
  legacyDaysToExpiryType,
  parseQuoteExpiryType,
  type QuoteExpiryPeriodType,
} from "@/lib/quote-expiry";
import type {
  CompanySettings,
  Customer,
  CustomerInput,
  InvoiceDocumentStatus,
  InvoiceItemRecord,
  InvoiceRecord,
  InvoiceInput,
  ItemTemplate,
  ItemTemplateInput,
  ProjectHistoryEvent,
  ProjectHistoryType,
  ProjectInput,
  ProjectItemRecord,
  ProjectRecord,
  ProjectStatus,
  InvoiceStatus,
  ProjectPaymentStatus,
  QuoteItemRecord,
  QuoteRecord,
  QuoteInput,
  QuoteStatus,
  RecurringBillingInput,
  RecurringBillingItemRecord,
  RecurringBillingRecord,
  RecurringBillingStatus,
  TaxRate,
  ItemTemplateCategory,
  ItemTemplateCategoryRecord,
} from "@/lib/types";
import { normalizeUnit } from "@/lib/constants/units";
import { normalizeProjectStatus } from "@/lib/project-utils";

function toIso(v: string | null | undefined): string {
  if (!v) return new Date().toISOString();
  return v.includes("T") ? v : `${v}T00:00:00.000Z`;
}

function toDateStr(v: string | null | undefined): string {
  if (!v) return "";
  return v.slice(0, 10);
}

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

function auditUserFields(row: {
  created_by?: string | null;
  updated_by?: string | null;
}) {
  return {
    createdBy: row.created_by ?? null,
    updatedBy: row.updated_by ?? null,
  };
}

// --- Company ---

export type CompanyRow = {
  id: string;
  company_name: string;
  postal_code: string;
  address: string;
  phone: string;
  fax?: string;
  contact_name?: string;
  email: string;
  invoice_number: string;
  bank_name: string;
  bank_branch: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_account_holder: string;
  logo_url: string | null;
  stamp_url: string | null;
  signature_url: string | null;
  quote_validity_days?: number | null;
  quote_default_expiry_type?: string | null;
  quote_memo_template?: string | null;
  invoice_memo_template?: string | null;
  payment_terms?: string | null;
  order_memo_template?: string | null;
  delivery_note_memo_template?: string | null;
  receipt_memo_template?: string | null;
  contract_status?: string | null;
  contract_started_at?: string | null;
  contract_ended_at?: string | null;
  created_at: string;
  updated_at: string;
};

function resolveCompanyDefaultExpiryType(row: CompanyRow): QuoteExpiryPeriodType {
  const raw = row.quote_default_expiry_type;
  if (raw && raw !== "custom") {
    const parsed = parseQuoteExpiryType(raw, DEFAULT_QUOTE_EXPIRY_TYPE);
    if (parsed !== "custom") return parsed;
  }
  const validityDays = row.quote_validity_days;
  if (validityDays != null && validityDays > 0) {
    return legacyDaysToExpiryType(Number(validityDays));
  }
  return DEFAULT_QUOTE_EXPIRY_TYPE;
}

export function companyFromRow(row: CompanyRow): CompanySettings {
  const validityDays = row.quote_validity_days;
  const quoteDefaultExpiryType = resolveCompanyDefaultExpiryType(row);
  return {
    id: row.id,
    companyName: row.company_name,
    postalCode: row.postal_code,
    address: row.address,
    phone: row.phone,
    fax: row.fax ?? "",
    contactName: row.contact_name ?? "",
    email: row.email,
    invoiceNumber: row.invoice_number,
    bankName: row.bank_name,
    bankBranch: row.bank_branch,
    bankAccountType: row.bank_account_type,
    bankAccountNumber: row.bank_account_number,
    bankAccountHolder: row.bank_account_holder,
    logoUrl: row.logo_url,
    stampUrl: row.stamp_url,
    signatureUrl: row.signature_url,
    quoteValidityDays:
      validityDays != null && validityDays > 0
        ? Number(validityDays)
        : expiryTypeToLegacyDays(quoteDefaultExpiryType),
    quoteDefaultExpiryType,
    quoteMemoTemplate:
      row.quote_memo_template != null ? String(row.quote_memo_template) : "",
    invoiceMemoTemplate:
      row.invoice_memo_template != null ? String(row.invoice_memo_template) : "",
    paymentTerms:
      row.payment_terms != null && String(row.payment_terms).trim()
        ? String(row.payment_terms)
        : "請求書発行後14日以内",
    orderMemoTemplate:
      row.order_memo_template != null ? String(row.order_memo_template) : "",
    deliveryNoteMemoTemplate:
      row.delivery_note_memo_template != null
        ? String(row.delivery_note_memo_template)
        : "",
    receiptMemoTemplate:
      row.receipt_memo_template != null ? String(row.receipt_memo_template) : "",
    contractStatus: (row.contract_status as import("@/lib/types/signup-access").ContractStatus) ?? "active",
    contractStartedAt: row.contract_started_at ? toIso(row.contract_started_at) : null,
    contractEndedAt: row.contract_ended_at ? toIso(row.contract_ended_at) : null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function companyToRow(s: CompanySettings): CompanyRow {
  return {
    id: s.id,
    company_name: s.companyName,
    postal_code: s.postalCode,
    address: s.address,
    phone: s.phone,
    fax: s.fax,
    contact_name: s.contactName,
    email: s.email,
    invoice_number: s.invoiceNumber,
    bank_name: s.bankName,
    bank_branch: s.bankBranch,
    bank_account_type: s.bankAccountType,
    bank_account_number: s.bankAccountNumber,
    bank_account_holder: s.bankAccountHolder,
    logo_url: s.logoUrl,
    stamp_url: s.stampUrl,
    signature_url: s.signatureUrl,
    quote_validity_days: expiryTypeToLegacyDays(s.quoteDefaultExpiryType),
    quote_default_expiry_type: s.quoteDefaultExpiryType,
    quote_memo_template: s.quoteMemoTemplate,
    invoice_memo_template: s.invoiceMemoTemplate,
    payment_terms: s.paymentTerms,
    order_memo_template: s.orderMemoTemplate,
    delivery_note_memo_template: s.deliveryNoteMemoTemplate,
    receipt_memo_template: s.receiptMemoTemplate,
    contract_status: s.contractStatus,
    contract_started_at: s.contractStartedAt,
    contract_ended_at: s.contractEndedAt,
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  };
}

/** companies テーブル UPDATE 用（id / created_at は送らない） */
export function companyToUpdateRow(
  s: CompanySettings
): Omit<CompanyRow, "id" | "created_at"> {
  return {
    company_name: s.companyName,
    postal_code: s.postalCode,
    address: s.address,
    phone: s.phone,
    fax: s.fax,
    contact_name: s.contactName,
    email: s.email,
    invoice_number: s.invoiceNumber,
    bank_name: s.bankName,
    bank_branch: s.bankBranch,
    bank_account_type: s.bankAccountType,
    bank_account_number: s.bankAccountNumber,
    bank_account_holder: s.bankAccountHolder,
    logo_url: s.logoUrl,
    stamp_url: s.stampUrl,
    signature_url: s.signatureUrl,
    quote_validity_days: expiryTypeToLegacyDays(s.quoteDefaultExpiryType),
    quote_default_expiry_type: s.quoteDefaultExpiryType,
    quote_memo_template: s.quoteMemoTemplate,
    invoice_memo_template: s.invoiceMemoTemplate,
    payment_terms: s.paymentTerms,
    order_memo_template: s.orderMemoTemplate,
    delivery_note_memo_template: s.deliveryNoteMemoTemplate,
    receipt_memo_template: s.receiptMemoTemplate,
    updated_at: s.updatedAt,
  };
}

// --- Customer ---

export type CustomerRow = {
  id: string;
  company_id: string;
  customer_name: string;
  contact_name: string;
  email: string;
  phone: string;
  fax?: string;
  postal_code: string;
  address: string;
  invoice_destination: string;
  memo: string;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function customerFromRow(row: CustomerRow): Customer {
  return {
    id: row.id,
    customerName: row.customer_name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    fax: row.fax ?? "",
    postalCode: row.postal_code,
    address: row.address,
    invoiceDestination: row.invoice_destination,
    memo: row.memo,
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function customerToRow(
  companyId: string,
  c: Customer | (CustomerInput & { id: string; createdAt: string; updatedAt: string })
): CustomerRow {
  return {
    id: c.id,
    company_id: companyId,
    customer_name: c.customerName,
    contact_name: c.contactName,
    email: c.email,
    phone: c.phone,
    fax: c.fax ?? "",
    postal_code: c.postalCode,
    address: c.address,
    invoice_destination: c.invoiceDestination,
    memo: c.memo,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

// --- Item template ---

export type ItemTemplateRow = {
  id: string;
  company_id: string;
  name: string;
  category: string;
  description: string;
  unit_price: number;
  tax_rate: number;
  is_favorite: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function itemTemplateFromRow(row: ItemTemplateRow): ItemTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ItemTemplateCategory,
    description: row.description,
    unitPrice: num(row.unit_price),
    taxRate: row.tax_rate as TaxRate,
    isFavorite: row.is_favorite,
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function itemTemplateToRow(
  companyId: string,
  t: ItemTemplate | (ItemTemplateInput & { id: string; createdAt: string; updatedAt: string })
): ItemTemplateRow {
  return {
    id: t.id,
    company_id: companyId,
    name: t.name,
    category: t.category,
    description: t.description,
    unit_price: t.unitPrice,
    tax_rate: t.taxRate,
    is_favorite: t.isFavorite,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

// --- Item template categories ---

export type ItemTemplateCategoryRow = {
  id: string;
  company_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function itemTemplateCategoryFromRow(
  row: ItemTemplateCategoryRow
): ItemTemplateCategoryRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function itemTemplateCategoryToRow(
  companyId: string,
  c: ItemTemplateCategoryRecord
): ItemTemplateCategoryRow {
  return {
    id: c.id,
    company_id: companyId,
    name: c.name,
    sort_order: c.sortOrder,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

// --- Project ---

export type ProjectRow = {
  id: string;
  company_id: string;
  customer_id: string;
  project_name: string;
  construction_site?: string;
  status: string;
  amount: number;
  due_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  assignee_name?: string | null;
  memo: string;
  invoice_status: string;
  payment_status: string;
  archived?: boolean | null;
  confirmed_date?: string | null;
  completed_date?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function projectFromRow(row: ProjectRow): ProjectRecord {
  const normalizedStatus = normalizeProjectStatus(row.status);
  const normalizedInvoiceStatus: InvoiceStatus =
    row.status === "invoiced" && row.invoice_status === "not_created"
      ? "issued"
      : (row.invoice_status as InvoiceStatus);
  const normalizedPaymentStatus: ProjectPaymentStatus =
    row.status === "paid" && row.payment_status !== "paid"
      ? "paid"
      : (row.payment_status as ProjectPaymentStatus);

  return {
    id: row.id,
    customerId: row.customer_id,
    projectName: row.project_name,
    constructionSite: row.construction_site ?? "",
    status: normalizedStatus as ProjectStatus,
    amount: num(row.amount),
    dueDate: toDateStr(row.due_date),
    startDate: toDateStr(row.start_date),
    endDate: toDateStr(row.end_date),
    assigneeName: row.assignee_name ?? "",
    memo: row.memo,
    invoiceStatus: normalizedInvoiceStatus,
    paymentStatus: normalizedPaymentStatus,
    archived: row.archived ?? false,
    confirmedDate: toDateStr(row.confirmed_date),
    completedDate: toDateStr(row.completed_date),
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function projectToRow(
  companyId: string,
  p: ProjectRecord
): ProjectRow {
  return {
    id: p.id,
    company_id: companyId,
    customer_id: p.customerId,
    project_name: p.projectName,
    construction_site: p.constructionSite ?? "",
    status: p.status,
    amount: p.amount,
    due_date: p.dueDate || null,
    start_date: p.startDate || null,
    end_date: p.endDate || null,
    assignee_name: p.assigneeName ?? "",
    memo: p.memo,
    invoice_status: p.invoiceStatus,
    payment_status: p.paymentStatus,
    archived: p.archived,
    confirmed_date: p.confirmedDate || null,
    completed_date: p.completedDate || null,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

// --- Project history ---

export type ProjectHistoryRow = {
  id: string;
  company_id: string;
  project_id: string;
  type: string;
  title: string;
  description: string | null;
  created_at: string;
};

export function projectHistoryFromRow(row: ProjectHistoryRow): ProjectHistoryEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type as ProjectHistoryType,
    title: row.title,
    description: row.description ?? undefined,
    createdAt: toIso(row.created_at),
  };
}

export function projectHistoryToRow(
  companyId: string,
  h: ProjectHistoryEvent
): ProjectHistoryRow {
  return {
    id: h.id,
    company_id: companyId,
    project_id: h.projectId,
    type: h.type,
    title: h.title,
    description: h.description ?? null,
    created_at: h.createdAt,
  };
}

// --- Project items ---

export type ProjectItemRow = {
  id: string;
  company_id: string;
  project_id: string;
  item_template_id: string | null;
  name: string;
  description: string;
  width?: string | null;
  height?: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function projectItemFromRow(row: ProjectItemRow): ProjectItemRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    itemTemplateId: row.item_template_id,
    name: row.name,
    description: row.description,
    width: row.width ?? "",
    height: row.height ?? "",
    quantity: num(row.quantity),
    unit: normalizeUnit(row.unit),
    unitPrice: num(row.unit_price),
    taxRate: num(row.tax_rate) as 0 | 0.08 | 0.1,
    amount: num(row.amount),
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function projectItemToRow(
  companyId: string,
  item: ProjectItemRecord
): ProjectItemRow {
  return {
    id: item.id,
    company_id: companyId,
    project_id: item.projectId,
    item_template_id: item.itemTemplateId,
    name: item.name,
    description: item.description,
    width: item.width || null,
    height: item.height || null,
    quantity: item.quantity,
    unit: normalizeUnit(item.unit),
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function buildProjectItems(
  companyId: string,
  projectId: string,
  input: ProjectInput,
  now: string
): ProjectItemRecord[] {
  return input.items.map((it, idx) => {
    const amount = it.quantity * it.unitPrice;
    return {
      id: `${projectId}_pi_${idx}_${Date.now().toString(36)}`,
      projectId,
      itemTemplateId: it.itemTemplateId,
      name: it.name,
      description: it.description,
      width: it.width ?? "",
      height: it.height ?? "",
      quantity: it.quantity,
      unit: normalizeUnit(it.unit),
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      amount,
      sortOrder: it.sortOrder ?? idx,
      createdAt: now,
      updatedAt: now,
    };
  });
}

// --- Quote ---

export type QuoteRow = {
  id: string;
  company_id: string;
  project_id: string;
  customer_id: string;
  quote_number: string;
  issue_date: string;
  expiry_type?: string | null;
  expiry_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  memo: string;
  payment_terms?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function quoteFromRow(row: QuoteRow): QuoteRecord {
  const projectId = String(row.project_id ?? "").trim();
  if (!projectId && process.env.NODE_ENV !== "production") {
    console.warn("[quoteFromRow] missing project_id", { quoteId: row.id });
  }
  return {
    id: row.id,
    projectId,
    customerId: row.customer_id,
    quoteNumber: row.quote_number,
    issueDate: toDateStr(row.issue_date),
    expiryType: parseQuoteExpiryType(row.expiry_type, "custom"),
    expiryDate: toDateStr(row.expiry_date),
    status: row.status as QuoteStatus,
    subtotal: num(row.subtotal),
    taxAmount: num(row.tax_amount),
    totalAmount: num(row.total_amount),
    memo: row.memo,
    paymentTerms: row.payment_terms != null ? String(row.payment_terms) : "",
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function quoteToRow(companyId: string, q: QuoteRecord): QuoteRow {
  return {
    id: q.id,
    company_id: companyId,
    project_id: q.projectId,
    customer_id: q.customerId,
    quote_number: q.quoteNumber,
    issue_date: q.issueDate,
    expiry_type: q.expiryType,
    expiry_date: q.expiryDate,
    status: q.status,
    subtotal: q.subtotal,
    tax_amount: q.taxAmount,
    total_amount: q.totalAmount,
    memo: q.memo,
    payment_terms: q.paymentTerms,
    created_at: q.createdAt,
    updated_at: q.updatedAt,
  };
}

export type QuoteItemRow = {
  id: string;
  company_id: string;
  quote_id: string;
  item_template_id: string | null;
  name: string;
  description: string;
  width?: string | null;
  height?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  tax_rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function quoteItemFromRow(row: QuoteItemRow): QuoteItemRecord {
  return {
    id: row.id,
    quoteId: row.quote_id,
    itemTemplateId: row.item_template_id,
    name: row.name,
    description: row.description,
    width: row.width ?? "",
    height: row.height ?? "",
    quantity: num(row.quantity),
    unit: normalizeUnit(row.unit),
    unitPrice: num(row.unit_price),
    taxRate: num(row.tax_rate) as 0 | 0.08 | 0.1,
    amount: num(row.amount),
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function quoteItemToRow(
  companyId: string,
  item: QuoteItemRecord
): QuoteItemRow {
  return {
    id: item.id,
    company_id: companyId,
    quote_id: item.quoteId,
    item_template_id: item.itemTemplateId,
    name: item.name,
    description: item.description,
    width: item.width || null,
    height: item.height || null,
    quantity: item.quantity,
    unit: normalizeUnit(item.unit),
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function buildQuoteItems(
  companyId: string,
  quoteId: string,
  input: QuoteInput,
  now: string
): QuoteItemRecord[] {
  return input.items.map((it, idx) => {
    const amount = it.quantity * it.unitPrice;
    return {
      id: `${quoteId}_qi_${idx}_${Date.now().toString(36)}`,
      quoteId,
      itemTemplateId: it.itemTemplateId,
      name: it.name,
      description: it.description,
      width: it.width ?? "",
      height: it.height ?? "",
      quantity: it.quantity,
      unit: normalizeUnit(it.unit),
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      amount,
      sortOrder: it.sortOrder ?? idx,
      createdAt: now,
      updatedAt: now,
    };
  });
}

// --- Invoice ---

export type InvoiceRow = {
  id: string;
  company_id: string;
  project_id: string;
  customer_id: string;
  quote_id: string;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  pdf_url: string | null;
  memo: string;
  payment_terms?: string | null;
  bank_account_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export function invoiceFromRow(row: InvoiceRow): InvoiceRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    customerId: row.customer_id,
    quoteId: row.quote_id,
    invoiceNumber: row.invoice_number,
    issueDate: toDateStr(row.issue_date),
    dueDate: toDateStr(row.due_date),
    status: row.status as InvoiceDocumentStatus,
    subtotal: num(row.subtotal),
    taxAmount: num(row.tax_amount),
    totalAmount: num(row.total_amount),
    pdfUrl: row.pdf_url,
    memo: row.memo,
    paymentTerms: row.payment_terms != null ? String(row.payment_terms) : "",
    bankAccountId: row.bank_account_id ?? null,
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function invoiceToRow(companyId: string, inv: InvoiceRecord): InvoiceRow {
  return {
    id: inv.id,
    company_id: companyId,
    project_id: inv.projectId,
    customer_id: inv.customerId,
    quote_id: inv.quoteId,
    invoice_number: inv.invoiceNumber,
    issue_date: inv.issueDate,
    due_date: inv.dueDate,
    status: inv.status,
    subtotal: inv.subtotal,
    tax_amount: inv.taxAmount,
    total_amount: inv.totalAmount,
    pdf_url: inv.pdfUrl,
    memo: inv.memo,
    payment_terms: inv.paymentTerms,
    bank_account_id: inv.bankAccountId,
    created_at: inv.createdAt,
    updated_at: inv.updatedAt,
  };
}

export type InvoiceItemRow = {
  id: string;
  company_id: string;
  invoice_id: string;
  quote_item_id: string | null;
  name: string;
  description: string;
  width?: string | null;
  height?: string | null;
  quantity: number;
  unit?: string;
  unit_price: number;
  tax_rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function invoiceItemFromRow(row: InvoiceItemRow): InvoiceItemRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    quoteItemId: row.quote_item_id,
    name: row.name,
    description: row.description,
    width: row.width ?? "",
    height: row.height ?? "",
    quantity: num(row.quantity),
    unit: normalizeUnit(row.unit),
    unitPrice: num(row.unit_price),
    taxRate: num(row.tax_rate) as 0 | 0.08 | 0.1,
    amount: num(row.amount),
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function invoiceItemToRow(
  companyId: string,
  item: InvoiceItemRecord
): InvoiceItemRow {
  return {
    id: item.id,
    company_id: companyId,
    invoice_id: item.invoiceId,
    quote_item_id: item.quoteItemId,
    name: item.name,
    description: item.description,
    width: item.width || null,
    height: item.height || null,
    quantity: item.quantity,
    unit: normalizeUnit(item.unit),
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function buildInvoiceItems(
  companyId: string,
  invoiceId: string,
  input: InvoiceInput,
  now: string
): InvoiceItemRecord[] {
  return input.items.map((it, idx) => {
    const amount = it.quantity * it.unitPrice;
    return {
      id: `${invoiceId}_ii_${idx}_${Date.now().toString(36)}`,
      invoiceId,
      quoteItemId: it.quoteItemId,
      name: it.name,
      description: it.description,
      width: it.width ?? "",
      height: it.height ?? "",
      quantity: it.quantity,
      unit: normalizeUnit(it.unit),
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      amount,
      sortOrder: it.sortOrder ?? idx,
      createdAt: now,
      updatedAt: now,
    };
  });
}

// --- Recurring ---

export type RecurringBillingRow = {
  id: string;
  company_id: string;
  customer_id: string;
  title: string;
  billing_day: number;
  next_billing_date: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  memo: string;
  created_at: string;
  updated_at: string;
};

export function recurringFromRow(row: RecurringBillingRow): RecurringBillingRecord {
  return {
    id: row.id,
    customerId: row.customer_id,
    title: row.title,
    billingDay: row.billing_day,
    nextBillingDate: toDateStr(row.next_billing_date),
    status: row.status as RecurringBillingStatus,
    subtotal: num(row.subtotal),
    taxAmount: num(row.tax_amount),
    totalAmount: num(row.total_amount),
    memo: row.memo,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function recurringToRow(
  companyId: string,
  r: RecurringBillingRecord
): RecurringBillingRow {
  return {
    id: r.id,
    company_id: companyId,
    customer_id: r.customerId,
    title: r.title,
    billing_day: r.billingDay,
    next_billing_date: r.nextBillingDate,
    status: r.status,
    subtotal: r.subtotal,
    tax_amount: r.taxAmount,
    total_amount: r.totalAmount,
    memo: r.memo,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
  };
}

export type RecurringBillingItemRow = {
  id: string;
  company_id: string;
  recurring_billing_id: string;
  item_template_id: string | null;
  name: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function recurringItemFromRow(
  row: RecurringBillingItemRow
): RecurringBillingItemRecord {
  return {
    id: row.id,
    recurringBillingId: row.recurring_billing_id,
    itemTemplateId: row.item_template_id,
    name: row.name,
    description: row.description,
    quantity: num(row.quantity),
    unitPrice: num(row.unit_price),
    taxRate: num(row.tax_rate) as 0 | 0.08 | 0.1,
    amount: num(row.amount),
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function recurringItemToRow(
  companyId: string,
  item: RecurringBillingItemRecord
): RecurringBillingItemRow {
  return {
    id: item.id,
    company_id: companyId,
    recurring_billing_id: item.recurringBillingId,
    item_template_id: item.itemTemplateId,
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function buildRecurringItems(
  recurringId: string,
  input: RecurringBillingInput,
  now: string
): RecurringBillingItemRecord[] {
  return input.items.map((it, idx) => {
    const amount = it.quantity * it.unitPrice;
    return {
      id: `${recurringId}_ri_${idx}_${Date.now().toString(36)}`,
      recurringBillingId: recurringId,
      itemTemplateId: it.itemTemplateId,
      name: it.name,
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      amount,
      sortOrder: it.sortOrder ?? idx,
      createdAt: now,
      updatedAt: now,
    };
  });
}

export function computeLineTotals(
  items: Array<{ amount: number; taxRate: number }>
) {
  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = items.reduce((s, i) => s + i.amount * i.taxRate, 0);
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}
