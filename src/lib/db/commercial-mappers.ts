import type {
  BankAccountRecord,
  DeliveryNoteItemRecord,
  DeliveryNoteRecord,
  OrderItemRecord,
  OrderRecord,
  ReceiptItemRecord,
  ReceiptRecord,
} from "@/lib/commercial-document";

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

export type BankAccountRow = {
  id: string;
  company_id: string;
  label: string;
  bank_name: string;
  bank_branch: string;
  bank_account_type: string;
  bank_account_number: string;
  bank_account_holder: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export function bankAccountFromRow(row: BankAccountRow): BankAccountRecord {
  return {
    id: row.id,
    label: row.label,
    bankName: row.bank_name,
    bankBranch: row.bank_branch,
    bankAccountType: row.bank_account_type,
    bankAccountNumber: row.bank_account_number,
    bankAccountHolder: row.bank_account_holder,
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function bankAccountToRow(
  companyId: string,
  account: BankAccountRecord
): BankAccountRow {
  return {
    id: account.id,
    company_id: companyId,
    label: account.label,
    bank_name: account.bankName,
    bank_branch: account.bankBranch,
    bank_account_type: account.bankAccountType,
    bank_account_number: account.bankAccountNumber,
    bank_account_holder: account.bankAccountHolder,
    sort_order: account.sortOrder,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

type CommercialHeaderRow = {
  id: string;
  company_id: string;
  project_id: string;
  customer_id: string;
  issue_date: string;
  payment_terms: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  discount_label?: string | null;
  discount_amount?: number | null;
  customer_contact_name?: string | null;
  customer_department?: string | null;
  customer_position?: string | null;
  memo: string;
  deleted_at?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderRow = CommercialHeaderRow & {
  quote_id: string;
  order_number: string;
  recipient_name?: string;
};

export type DeliveryNoteRow = CommercialHeaderRow & {
  order_id: string;
  delivery_note_number: string;
};

export type ReceiptRow = CommercialHeaderRow & {
  invoice_id: string;
  receipt_number: string;
};

type CommercialItemRow = {
  id: string;
  company_id: string;
  item_template_id: string | null;
  name: string;
  description: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  amount: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = CommercialItemRow & { order_id: string };
export type DeliveryNoteItemRow = CommercialItemRow & { delivery_note_id: string };
export type ReceiptItemRow = CommercialItemRow & { receipt_id: string };

function itemFromRowBase(row: CommercialItemRow) {
  return {
    id: row.id,
    itemTemplateId: row.item_template_id,
    name: row.name,
    description: row.description,
    width: row.width ?? "",
    height: row.height ?? "",
    quantity: num(row.quantity),
    unit: row.unit,
    unitPrice: num(row.unit_price),
    taxRate: num(row.tax_rate) as 0 | 0.08 | 0.1,
    amount: num(row.amount),
    sortOrder: row.sort_order,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function orderFromRow(row: OrderRow): OrderRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    customerId: row.customer_id,
    quoteId: row.quote_id,
    orderNumber: row.order_number,
    issueDate: toDateStr(row.issue_date),
    paymentTerms: row.payment_terms ?? "",
    status: row.status as OrderRecord["status"],
    subtotal: num(row.subtotal),
    taxAmount: num(row.tax_amount),
    totalAmount: num(row.total_amount),
    discountLabel: row.discount_label != null ? String(row.discount_label) : "",
    discountAmount: num(row.discount_amount),
    customerContactName: row.customer_contact_name != null ? String(row.customer_contact_name) : "",
    customerDepartment: row.customer_department != null ? String(row.customer_department) : "",
    customerPosition: row.customer_position != null ? String(row.customer_position) : "",
    memo: row.memo,
    recipientName: row.recipient_name ?? "",
    deletedAt: row.deleted_at ?? null,
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function orderItemFromRow(row: OrderItemRow): OrderItemRecord {
  return { ...itemFromRowBase(row), orderId: row.order_id };
}

export function deliveryNoteFromRow(row: DeliveryNoteRow): DeliveryNoteRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    customerId: row.customer_id,
    orderId: row.order_id,
    deliveryNoteNumber: row.delivery_note_number,
    issueDate: toDateStr(row.issue_date),
    paymentTerms: row.payment_terms ?? "",
    status: row.status as DeliveryNoteRecord["status"],
    subtotal: num(row.subtotal),
    taxAmount: num(row.tax_amount),
    totalAmount: num(row.total_amount),
    discountLabel: row.discount_label != null ? String(row.discount_label) : "",
    discountAmount: num(row.discount_amount),
    customerContactName: row.customer_contact_name != null ? String(row.customer_contact_name) : "",
    customerDepartment: row.customer_department != null ? String(row.customer_department) : "",
    customerPosition: row.customer_position != null ? String(row.customer_position) : "",
    memo: row.memo,
    deletedAt: row.deleted_at ?? null,
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function deliveryNoteItemFromRow(
  row: DeliveryNoteItemRow
): DeliveryNoteItemRecord {
  return { ...itemFromRowBase(row), deliveryNoteId: row.delivery_note_id };
}

export function receiptFromRow(row: ReceiptRow): ReceiptRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    customerId: row.customer_id,
    invoiceId: row.invoice_id,
    receiptNumber: row.receipt_number,
    issueDate: toDateStr(row.issue_date),
    paymentTerms: row.payment_terms ?? "",
    status: row.status as ReceiptRecord["status"],
    subtotal: num(row.subtotal),
    taxAmount: num(row.tax_amount),
    totalAmount: num(row.total_amount),
    discountLabel: row.discount_label != null ? String(row.discount_label) : "",
    discountAmount: num(row.discount_amount),
    customerContactName: row.customer_contact_name != null ? String(row.customer_contact_name) : "",
    customerDepartment: row.customer_department != null ? String(row.customer_department) : "",
    customerPosition: row.customer_position != null ? String(row.customer_position) : "",
    memo: row.memo,
    deletedAt: row.deleted_at ?? null,
    ...auditUserFields(row),
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function receiptItemFromRow(row: ReceiptItemRow): ReceiptItemRecord {
  return { ...itemFromRowBase(row), receiptId: row.receipt_id };
}

export function orderToRow(companyId: string, order: OrderRecord): OrderRow {
  return {
    id: order.id,
    company_id: companyId,
    project_id: order.projectId,
    customer_id: order.customerId,
    quote_id: order.quoteId,
    order_number: order.orderNumber,
    issue_date: order.issueDate,
    payment_terms: order.paymentTerms,
    status: order.status,
    subtotal: order.subtotal,
    tax_amount: order.taxAmount,
    total_amount: order.totalAmount,
    discount_label: order.discountLabel,
    discount_amount: order.discountAmount,
    customer_contact_name: order.customerContactName || null,
    customer_department: order.customerDepartment || null,
    customer_position: order.customerPosition || null,
    memo: order.memo,
    recipient_name: order.recipientName,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
  };
}

export function orderItemToRow(
  companyId: string,
  item: OrderItemRecord
): OrderItemRow {
  return {
    id: item.id,
    company_id: companyId,
    order_id: item.orderId,
    item_template_id: item.itemTemplateId,
    name: item.name,
    description: item.description,
    width: item.width,
    height: item.height,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function deliveryNoteToRow(
  companyId: string,
  note: DeliveryNoteRecord
): DeliveryNoteRow {
  return {
    id: note.id,
    company_id: companyId,
    project_id: note.projectId,
    customer_id: note.customerId,
    order_id: note.orderId,
    delivery_note_number: note.deliveryNoteNumber,
    issue_date: note.issueDate,
    payment_terms: note.paymentTerms,
    status: note.status,
    subtotal: note.subtotal,
    tax_amount: note.taxAmount,
    total_amount: note.totalAmount,
    discount_label: note.discountLabel,
    discount_amount: note.discountAmount,
    customer_contact_name: note.customerContactName || null,
    customer_department: note.customerDepartment || null,
    customer_position: note.customerPosition || null,
    memo: note.memo,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

export function deliveryNoteItemToRow(
  companyId: string,
  item: DeliveryNoteItemRecord
): DeliveryNoteItemRow {
  return {
    id: item.id,
    company_id: companyId,
    delivery_note_id: item.deliveryNoteId,
    item_template_id: item.itemTemplateId,
    name: item.name,
    description: item.description,
    width: item.width,
    height: item.height,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export function receiptToRow(companyId: string, receipt: ReceiptRecord): ReceiptRow {
  return {
    id: receipt.id,
    company_id: companyId,
    project_id: receipt.projectId,
    customer_id: receipt.customerId,
    invoice_id: receipt.invoiceId,
    receipt_number: receipt.receiptNumber,
    issue_date: receipt.issueDate,
    payment_terms: receipt.paymentTerms,
    status: receipt.status,
    subtotal: receipt.subtotal,
    tax_amount: receipt.taxAmount,
    total_amount: receipt.totalAmount,
    discount_label: receipt.discountLabel,
    discount_amount: receipt.discountAmount,
    customer_contact_name: receipt.customerContactName || null,
    customer_department: receipt.customerDepartment || null,
    customer_position: receipt.customerPosition || null,
    memo: receipt.memo,
    created_at: receipt.createdAt,
    updated_at: receipt.updatedAt,
  };
}

export function receiptItemToRow(
  companyId: string,
  item: ReceiptItemRecord
): ReceiptItemRow {
  return {
    id: item.id,
    company_id: companyId,
    receipt_id: item.receiptId,
    item_template_id: item.itemTemplateId,
    name: item.name,
    description: item.description,
    width: item.width,
    height: item.height,
    quantity: item.quantity,
    unit: item.unit,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate,
    amount: item.amount,
    sort_order: item.sortOrder,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

export const DOCUMENT_MANAGEMENT_TABLES = [
  "bank_accounts",
  "orders",
  "order_items",
  "delivery_notes",
  "delivery_note_items",
  "receipts",
  "receipt_items",
] as const;
