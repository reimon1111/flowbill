"use client";

import type { Customer, InvoiceItemRecord, InvoiceRecord } from "@/lib/types";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { resolveBankAccountsForInvoiceDisplay } from "@/lib/services/bank-accounts";
import { DocumentLayout } from "@/components/documents/document-layout";

export function InvoicePreview({
  invoice,
  customer,
  items,
  projectName,
  constructionSite = "",
}: {
  invoice: InvoiceRecord;
  customer: Customer;
  items: InvoiceItemRecord[];
  projectName: string;
  constructionSite?: string;
}) {
  useCompanySettingsStore((s) => s.settings);
  useBankAccountStore((s) => s.bankAccounts);
  const company = useCompanySettingsStore.getState().getSettings();
  const bankAccounts = resolveBankAccountsForInvoiceDisplay(invoice.bankAccountId);

  return (
    <DocumentLayout
      kind="invoice"
      documentNumber={invoice.invoiceNumber}
      issueDate={invoice.issueDate}
      secondDate={invoice.dueDate}
      customerName={customer.customerName}
      contactName={customer.contactName}
      subject={projectName}
      constructionSite={constructionSite}
      paymentTerms={invoice.paymentTerms}
      items={items}
      subtotal={invoice.subtotal}
      taxAmount={invoice.taxAmount}
      totalAmount={invoice.totalAmount}
      memo={invoice.memo}
      memoTemplate={company.invoiceMemoTemplate}
      company={company}
      bankAccounts={bankAccounts}
    />
  );
}
