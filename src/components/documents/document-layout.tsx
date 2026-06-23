"use client";

import type { CompanySettings } from "@/lib/types";
import type { BankAccountDisplay } from "@/lib/services/bank-accounts";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import { DocumentCompanyInfo } from "@/components/documents/document-company-info";
import { DocumentFooter } from "@/components/documents/document-footer";
import { DocumentHeader } from "@/components/documents/document-header";
import {
  DocumentItemsTable,
  type DocumentLineItem,
} from "@/components/documents/document-items-table";
import { DocumentPaymentTerms } from "@/components/documents/document-payment-terms";
import { DocumentSummary } from "@/components/documents/document-summary";

export type DocumentLayoutProps = {
  kind: DocumentKind;
  documentNumber: string;
  issueDate: string;
  secondDate?: string;
  customerName: string;
  contactName?: string;
  subject: string;
  constructionSite?: string;
  paymentTerms?: string;
  items: DocumentLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  memoTemplate: string;
  company: CompanySettings;
  bankAccounts?: BankAccountDisplay[];
};

export function DocumentLayout({
  kind,
  documentNumber,
  issueDate,
  secondDate,
  customerName,
  contactName,
  subject,
  constructionSite = "",
  paymentTerms = "",
  items,
  subtotal,
  taxAmount,
  totalAmount,
  memo,
  memoTemplate,
  company,
  bankAccounts,
}: DocumentLayoutProps) {
  const labels = getDocumentLabels(kind);
  const subjectText = subject.trim()
    ? `件名：${subject.trim()}${labels.subjectSuffix}`
    : "";

  return (
    <div className="print-area document-preview document-page compact-print overflow-visible rounded-2xl border border-zinc-200/80 bg-white px-8 py-8 pr-10 font-sans shadow-sm shadow-zinc-900/[0.04]">
      <DocumentHeader
        kind={kind}
        documentNumber={documentNumber}
        issueDate={issueDate}
        secondDate={secondDate}
        customerName={customerName}
        contactName={contactName}
      />

      <div className="document-intro mt-3 flex items-start justify-between gap-6 overflow-visible">
        <div className="document-intro-left min-w-0 max-w-[48%] flex-1">
          {subjectText ? (
            <p className="document-subject text-[13px] text-zinc-900">{subjectText}</p>
          ) : null}
          {labels.showConstructionSite && constructionSite.trim() ? (
            <p className="document-construction-site mt-0.5 text-[13px] text-zinc-900">
              工事場所：{constructionSite.trim()}
            </p>
          ) : null}
          <p className="document-greeting mt-1 text-[13px] text-zinc-800">
            {labels.greeting}
          </p>
          {labels.showPaymentTerms ? (
            <DocumentPaymentTerms paymentTerms={paymentTerms} />
          ) : null}
          <DocumentSummary kind={kind} totalAmount={totalAmount} />
        </div>
        <DocumentCompanyInfo company={company} />
      </div>

      <DocumentItemsTable items={items} />

      <DocumentFooter
        kind={kind}
        subtotal={subtotal}
        taxAmount={taxAmount}
        totalAmount={totalAmount}
        memo={memo}
        memoTemplate={memoTemplate}
        company={company}
        bankAccounts={bankAccounts}
      />
    </div>
  );
}
