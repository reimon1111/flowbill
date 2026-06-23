/** 注文書・納品書・領収書の共通型 */

export type CommercialDocumentStatus = "draft" | "issued";

export type CommercialDocumentItemRecord = {
  id: string;
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
  itemTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CommercialDocumentItemInput = {
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

export type CommercialDocumentInput = {
  projectId: string;
  customerId: string;
  issueDate: string;
  paymentTerms: string;
  memo: string;
  items: CommercialDocumentItemInput[];
};

export type OrderRecord = {
  id: string;
  projectId: string;
  customerId: string;
  quoteId: string;
  orderNumber: string;
  issueDate: string;
  paymentTerms: string;
  status: CommercialDocumentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  /** 注文書の宛名（空欄可・帳票では手書き用スペースを表示） */
  recipientName: string;
  createdAt: string;
  updatedAt: string;
};

export type OrderInput = CommercialDocumentInput & {
  quoteId?: string;
  recipientName?: string;
};
export type OrderItemRecord = CommercialDocumentItemRecord & {
  orderId: string;
};

export type OrderListItem = OrderRecord & {
  projectName: string;
  customerName: string;
};

export type DeliveryNoteRecord = {
  id: string;
  projectId: string;
  customerId: string;
  orderId: string;
  deliveryNoteNumber: string;
  issueDate: string;
  paymentTerms: string;
  status: CommercialDocumentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type DeliveryNoteItemRecord = CommercialDocumentItemRecord & {
  deliveryNoteId: string;
};

export type DeliveryNoteInput = CommercialDocumentInput & {
  orderId?: string;
};

export type DeliveryNoteListItem = DeliveryNoteRecord & {
  projectName: string;
  customerName: string;
};

export type ReceiptRecord = {
  id: string;
  projectId: string;
  customerId: string;
  invoiceId: string;
  receiptNumber: string;
  issueDate: string;
  paymentTerms: string;
  status: CommercialDocumentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  createdAt: string;
  updatedAt: string;
};

export type ReceiptItemRecord = CommercialDocumentItemRecord & {
  receiptId: string;
};

export type ReceiptInput = CommercialDocumentInput & {
  invoiceId?: string;
};

export type ReceiptListItem = ReceiptRecord & {
  projectName: string;
  customerName: string;
};

export type BankAccountRecord = {
  id: string;
  label: string;
  bankName: string;
  bankBranch: string;
  bankAccountType: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type BankAccountInput = Omit<
  BankAccountRecord,
  "id" | "createdAt" | "updatedAt"
>;

/** 帳票プレビュー用の共通ビュー */
export type CommercialDocView = {
  documentNumber: string;
  issueDate: string;
  paymentTerms: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
};

export function toCommercialDocView(
  documentNumber: string,
  record: Pick<
    OrderRecord,
    | "issueDate"
    | "paymentTerms"
    | "subtotal"
    | "taxAmount"
    | "totalAmount"
    | "memo"
  >
): CommercialDocView {
  return {
    documentNumber,
    issueDate: record.issueDate,
    paymentTerms: record.paymentTerms,
    subtotal: record.subtotal,
    taxAmount: record.taxAmount,
    totalAmount: record.totalAmount,
    memo: record.memo,
  };
}
