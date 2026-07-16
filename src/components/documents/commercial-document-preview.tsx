"use client";

import type { Customer } from "@/lib/types";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getMemoTemplateKey } from "@/components/documents/document-labels";
import { DocumentLayout } from "@/components/documents/document-layout";
import { OrderDocumentLayout } from "@/components/documents/order-document-layout";
import { toDocumentLineItems } from "@/lib/document-items";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { resolveBankAccountsForInvoiceDisplay } from "@/lib/services/bank-accounts";
import type { CommercialDocumentItemRecord, CommercialDocView } from "@/lib/commercial-document";

type CommercialDoc = CommercialDocView;

export function CommercialDocumentPreview({
  kind,
  document,
  customer,
  items,
  projectName,
  constructionSite = "",
  secondDate,
  bankAccountId,
  recipientName,
}: {
  kind: DocumentKind;
  document: CommercialDoc;
  customer: Customer;
  items: CommercialDocumentItemRecord[];
  projectName: string;
  constructionSite?: string;
  secondDate?: string;
  bankAccountId?: string | null;
  /** 注文書のみ：宛名（空欄可） */
  recipientName?: string;
}) {
  useCompanySettingsStore((s) => s.settings);
  useBankAccountStore((s) => s.bankAccounts);
  const company = useCompanySettingsStore.getState().getSettings();
  const memoKey = getMemoTemplateKey(kind);
  const bankAccounts =
    kind === "invoice"
      ? resolveBankAccountsForInvoiceDisplay(bankAccountId)
      : undefined;

  const sharedProps = {
    documentNumber: document.documentNumber,
    issueDate: document.issueDate,
    subject: projectName,
    constructionSite,
    paymentTerms: document.paymentTerms,
    items: toDocumentLineItems(items),
    subtotal: document.subtotal,
    taxAmount: document.taxAmount,
    totalAmount: document.totalAmount,
    discountLabel: document.discountLabel,
    discountAmount: document.discountAmount,
    memo: document.memo,
    memoTemplate: company[memoKey] ?? "",
    company,
  };

  if (kind === "order") {
    return (
      <OrderDocumentLayout
        {...sharedProps}
        recipientName={recipientName ?? ""}
      />
    );
  }

  return (
    <DocumentLayout
      kind={kind}
      secondDate={secondDate}
      customerName={customer.customerName}
      contactName={document.customerContactName}
      department={document.customerDepartment}
      position={document.customerPosition}
      honorific={document.customerHonorific}
      bankAccounts={bankAccounts}
      {...sharedProps}
    />
  );
}
