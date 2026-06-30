export type ProjectStatus =
  | "estimate"
  | "ordered"
  | "in_progress"
  | "completed"
  | "lost";

export type InvoiceStatus = "not_created" | "draft" | "issued" | "sent";

export type ProjectPaymentStatus = "unpaid" | "paid" | "overdue";

/** DB保存用（customer_name は含めない） */
export type ProjectRecord = {
  id: string;
  customerId: string;
  projectName: string;
  constructionSite: string;
  status: ProjectStatus;
  amount: number;
  dueDate: string;
  startDate: string;
  endDate: string;
  assigneeName: string;
  memo: string;
  invoiceStatus: InvoiceStatus;
  paymentStatus: ProjectPaymentStatus;
  archived: boolean;
  confirmedDate: string;
  completedDate: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 一覧・詳細表示用 */
export type ProjectListItem = ProjectRecord & {
  customerName: string;
  nextAction: string;
};

export type ProjectItemInput = {
  itemTemplateId: string | null;
  name: string;
  description: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: 0 | 0.08 | 0.1;
  sortOrder: number;
};

export type ProjectInput = {
  customerId: string;
  projectName: string;
  constructionSite: string;
  status: ProjectStatus;
  amount: number;
  dueDate: string;
  startDate: string;
  endDate: string;
  assigneeName: string;
  memo: string;
  items: ProjectItemInput[];
};

/** 案件明細（スナップショット保存） */
export type ProjectItemRecord = {
  id: string;
  projectId: string;
  itemTemplateId: string | null;
  name: string;
  description: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: 0 | 0.08 | 0.1;
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ProjectHistoryType =
  | "created"
  | "status_changed"
  | "invoice_generated"
  | "payment_received"
  | "updated";

export type ProjectActionType =
  | "mark_ordered"
  | "mark_in_progress"
  | "mark_completed"
  | "generate_invoice"
  | "mark_paid";

export type ProjectHistoryEvent = {
  id: string;
  projectId: string;
  type: ProjectHistoryType;
  title: string;
  description?: string;
  createdAt: string;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export type { QuoteExpiryType } from "@/lib/quote-expiry";

/** 見積（DB保存用） */
export type QuoteRecord = {
  id: string;
  projectId: string;
  customerId: string;
  quoteNumber: string;
  issueDate: string; // YYYY-MM-DD
  expiryType: import("@/lib/quote-expiry").QuoteExpiryType;
  expiryDate: string; // YYYY-MM-DD
  status: QuoteStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  paymentTerms: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

/** 見積明細（重要: 過去を固定するためスナップショット保存） */
export type QuoteItemRecord = {
  id: string;
  quoteId: string;
  itemTemplateId: string | null;
  name: string;
  description: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: 0 | 0.08 | 0.1;
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type QuoteInput = {
  projectId: string;
  customerId: string;
  issueDate: string;
  expiryType: import("@/lib/quote-expiry").QuoteExpiryType;
  expiryDate: string;
  memo: string;
  paymentTerms: string;
  items: Array<{
    itemTemplateId: string | null;
    name: string;
    description: string;
    width: string;
    height: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    taxRate: 0 | 0.08 | 0.1;
    sortOrder: number;
  }>;
};

/** 一覧/詳細表示用（案件/顧客名は参照で解決） */
export type QuoteListItem = QuoteRecord & {
  projectName: string;
  customerName: string;
};

export type InvoiceDocumentStatus =
  | "draft"
  | "issued"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled";

export type InvoiceRecord = {
  id: string;
  projectId: string;
  customerId: string;
  quoteId: string;
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  status: InvoiceDocumentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  pdfUrl: string | null;
  memo: string;
  paymentTerms: string;
  bankAccountId: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceItemRecord = {
  id: string;
  invoiceId: string;
  quoteItemId: string | null;
  name: string;
  description: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: 0 | 0.08 | 0.1;
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type InvoiceInput = {
  projectId: string;
  customerId: string;
  quoteId: string;
  issueDate: string;
  dueDate: string;
  memo: string;
  paymentTerms: string;
  bankAccountId?: string | null;
  items: Array<{
    quoteItemId: string | null;
    name: string;
    description: string;
    width: string;
    height: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    taxRate: 0 | 0.08 | 0.1;
    sortOrder: number;
  }>;
};

export type InvoiceListItem = InvoiceRecord & {
  projectName: string;
  customerName: string;
  quoteNumber: string;
};

/** 顧客マスタ（Supabase customers テーブル対応想定） */
export type Customer = {
  id: string;
  customerName: string;
  contactName: string;
  email: string;
  phone: string;
  fax: string;
  postalCode: string;
  address: string;
  invoiceDestination: string;
  memo: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CustomerListItem = Customer & {
  activeProjectCount: number;
  unpaidAmount: number;
};

export type CustomerInput = Omit<
  Customer,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;

export const ITEM_TEMPLATE_CATEGORIES = [
  "制作",
  "保守",
  "工事",
  "材料",
  "作業",
  "交通費",
  "その他",
] as const;

// 自由入力（既存カテゴリは候補として保持）
export type ItemTemplateCategory = string;

export type TaxRate = 10 | 8 | 0;

export type ItemTemplate = {
  id: string;
  name: string;
  category: ItemTemplateCategory;
  description: string;
  unitPrice: number;
  taxRate: TaxRate;
  isFavorite: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ItemTemplateInput = Omit<
  ItemTemplate,
  "id" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"
>;

/** 請求項目テンプレのカテゴリマスタ（DB保存用） */
export type ItemTemplateCategoryRecord = {
  id: string;
  companyId: string;
  name: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ItemTemplateCategoryInput = Pick<
  ItemTemplateCategoryRecord,
  "name" | "sortOrder"
>;

export type CompanySettings = {
  id: string;
  companyName: string;
  postalCode: string;
  address: string;
  phone: string;
  fax: string;
  contactName: string;
  email: string;
  invoiceNumber: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  logoUrl: string | null;
  stampUrl: string | null;
  signatureUrl: string | null;
  /** @deprecated DB互換用。UIでは quoteDefaultExpiryType を使用 */
  quoteValidityDays: number;
  /** 見積のデフォルト有効期限（期間） */
  quoteDefaultExpiryType: import("@/lib/quote-expiry").QuoteExpiryPeriodType;
  /** 見積書備考のデフォルト文言 */
  quoteMemoTemplate: string;
  /** 請求書備考のデフォルト文言 */
  invoiceMemoTemplate: string;
  /** デフォルト支払い条件 */
  paymentTerms: string;
  /** 注文書備考テンプレ */
  orderMemoTemplate: string;
  /** 納品書備考テンプレ */
  deliveryNoteMemoTemplate: string;
  /** 領収書備考テンプレ */
  receiptMemoTemplate: string;
  contractStatus: import("@/lib/types/signup-access").ContractStatus;
  contractStartedAt: string | null;
  contractEndedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type {
  BankAccountRecord,
  BankAccountInput,
  OrderRecord,
  OrderItemRecord,
  OrderInput,
  OrderListItem,
  DeliveryNoteRecord,
  DeliveryNoteItemRecord,
  DeliveryNoteInput,
  DeliveryNoteListItem,
  ReceiptRecord,
  ReceiptItemRecord,
  ReceiptInput,
  ReceiptListItem,
} from "@/lib/commercial-document";

export type CustomerProjectSummary = {
  id: string;
  projectName: string;
  status: ProjectStatus;
  amount: number;
};

export type CustomerInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  amount: number;
  status: ProjectPaymentStatus;
};

/** 定期請求ステータス */
export type RecurringBillingStatus = "active" | "paused" | "ended";

/** 定期請求（DB保存用） */
export type RecurringBillingRecord = {
  id: string;
  customerId: string;
  title: string;
  billingDay: number;
  nextBillingDate: string;
  status: RecurringBillingStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

/** 定期請求明細 */
export type RecurringBillingItemRecord = {
  id: string;
  recurringBillingId: string;
  itemTemplateId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: 0 | 0.08 | 0.1;
  amount: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type RecurringBillingInput = {
  customerId: string;
  title: string;
  billingDay: number;
  nextBillingDate: string;
  memo: string;
  items: Array<{
    itemTemplateId: string | null;
    name: string;
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: 0 | 0.08 | 0.1;
    sortOrder: number;
  }>;
};

export type RecurringBillingListItem = RecurringBillingRecord & {
  customerName: string;
};

/** @deprecated ダッシュボード互換用。ProjectListItem を使用してください */
export type Project = ProjectListItem;
