"use client";

import type { Customer, QuoteItemRecord, QuoteRecord } from "@/lib/types";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { DocumentLayout } from "@/components/documents/document-layout";

export function QuotePreview({
  quote,
  customer,
  items,
  projectName,
  constructionSite = "",
}: {
  quote: QuoteRecord;
  customer: Customer;
  items: QuoteItemRecord[];
  projectName: string;
  constructionSite?: string;
}) {
  const company = useCompanySettingsStore((s) => s.settings);

  return (
    <DocumentLayout
      kind="quote"
      documentNumber={quote.quoteNumber}
      issueDate={quote.issueDate}
      secondDate={quote.expiryDate}
      customerName={customer.customerName}
      contactName={quote.customerContactName}
      department={quote.customerDepartment}
      position={quote.customerPosition}
      subject={projectName}
      constructionSite={constructionSite}
      paymentTerms={quote.paymentTerms}
      items={items}
      subtotal={quote.subtotal}
      taxAmount={quote.taxAmount}
      totalAmount={quote.totalAmount}
      discountLabel={quote.discountLabel}
      discountAmount={quote.discountAmount}
      memo={quote.memo}
      memoTemplate={company.quoteMemoTemplate}
      company={company}
    />
  );
}
