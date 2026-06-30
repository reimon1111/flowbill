"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QuotePreview } from "@/components/quotes/quote-preview";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import type {
  Customer,
  InvoiceItemRecord,
  InvoiceRecord,
  QuoteItemRecord,
  QuoteRecord,
} from "@/lib/types";

const sampleCustomer: Customer = {
  id: "c_sample",
  customerName: "株式会社サンプル",
  contactName: "田中 一郎",
  email: "tanaka@example.com",
  phone: "03-0000-0000",
  fax: "03-0000-0001",
  postalCode: "100-0001",
  address: "東京都千代田区1-2-3",
  invoiceDestination: "",
  memo: "",
  createdBy: null,
  updatedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleQuote: QuoteRecord = {
  id: "qt_sample",
  projectId: "p_sample",
  customerId: sampleCustomer.id,
  quoteNumber: "QT-2026-0001",
  issueDate: "2026-05-25",
  expiryType: "2_weeks",
  expiryDate: "2026-06-08",
  status: "sent",
  subtotal: 185000,
  taxAmount: 18500,
  totalAmount: 203500,
  memo: "",
  paymentTerms: "納品後お支払い",
  createdBy: null,
  updatedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleQuoteItems: QuoteItemRecord[] = [
  {
    id: "qti_sample_1",
    quoteId: sampleQuote.id,
    itemTemplateId: null,
    name: "ガラス交換",
    description: "",
    width: "900",
    height: "1800",
    quantity: 1,
    unit: "枚",
    unitPrice: 25000,
    taxRate: 0.1,
    amount: 25000,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "qti_sample_2",
    quoteId: sampleQuote.id,
    itemTemplateId: null,
    name: "サッシ工事",
    description: "",
    width: "1800",
    height: "900",
    quantity: 2,
    unit: "セット",
    unitPrice: 80000,
    taxRate: 0.1,
    amount: 160000,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const sampleInvoice: InvoiceRecord = {
  id: "inv_sample",
  projectId: "p_sample",
  customerId: sampleCustomer.id,
  quoteId: sampleQuote.id,
  invoiceNumber: "INV-2026-0001",
  issueDate: "2026-05-25",
  dueDate: "2026-06-24",
  status: "issued",
  subtotal: 185000,
  taxAmount: 18500,
  totalAmount: 203500,
  pdfUrl: null,
  memo: "",
  paymentTerms: "請求書発行後14日以内",
  bankAccountId: null,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleInvoiceItems: InvoiceItemRecord[] = sampleQuoteItems.map((it) => ({
  ...it,
  id: it.id.replace("qti_", "invi_"),
  invoiceId: sampleInvoice.id,
  quoteItemId: it.id,
}));

const sampleProjectName = "〇〇邸 サッシ交換工事";
const sampleConstructionSite = "東京都渋谷区神宮前1-2-3";

export function DocumentPreviewCard() {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03]">
      <div className="border-b border-zinc-100 px-6 py-4">
        <h2 className="text-lg font-semibold text-zinc-900">帳票プレビュー</h2>
        <p className="mt-1 text-sm text-zinc-500">
          見積書・請求書のレイアウトを確認できます（建築・工事業向け明細形式）
        </p>
      </div>
      <Tabs defaultValue="quote" className="p-6">
        <TabsList className="mb-6 grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="quote">見積書</TabsTrigger>
          <TabsTrigger value="invoice">請求書</TabsTrigger>
        </TabsList>
        <TabsContent value="quote" className="mt-0 overflow-visible">
          <QuotePreview
            quote={sampleQuote}
            customer={sampleCustomer}
            items={sampleQuoteItems}
            projectName={sampleProjectName}
            constructionSite={sampleConstructionSite}
          />
        </TabsContent>
        <TabsContent value="invoice" className="mt-0 overflow-visible">
          <InvoicePreview
            invoice={sampleInvoice}
            customer={sampleCustomer}
            items={sampleInvoiceItems}
            projectName={sampleProjectName}
            constructionSite={sampleConstructionSite}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
