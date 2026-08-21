"use client";

import type { Customer, InvoiceItemRecord, InvoiceRecord } from "@/lib/types";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { resolveBankAccountsForInvoiceDisplay } from "@/lib/services/bank-accounts";
import { DocumentLayout } from "@/components/documents/document-layout";
import { formatDate } from "@/lib/format";
import { resolveInvoiceDueDateDisplay } from "@/lib/invoice-due-date";

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
  const dueDisplay = resolveInvoiceDueDateDisplay(invoice, formatDate);

  return (
    <DocumentLayout
      kind="invoice"
      documentNumber={invoice.invoiceNumber}
      issueDate={invoice.issueDate}
      secondDateDisplay={dueDisplay}
      customerName={customer.customerName}
      contactName={invoice.customerContactName}
      department={invoice.customerDepartment}
      position={invoice.customerPosition}
      honorific={invoice.customerHonorific}
      subject={projectName}
      constructionSite={constructionSite}
      paymentTerms={invoice.paymentTerms}
      items={items}
      subtotal={invoice.subtotal}
      taxAmount={invoice.taxAmount}
      totalAmount={invoice.totalAmount}
      discountLabel={invoice.discountLabel}
      discountAmount={invoice.discountAmount}
      memo={invoice.memo}
      memoFontSize={invoice.memoFontSize}
      memoTemplate={company.invoiceMemoTemplate}
      documentEmail={invoice.documentEmail}
      company={company}
      bankAccounts={bankAccounts}
    />
  );
}
