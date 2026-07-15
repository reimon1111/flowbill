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
  /** 先方担当者名（書類スナップショット） */
  contactName?: string;
  /** 先方部署 */
  department?: string;
  /** 先方役職 */
  position?: string;
  subject: string;
  constructionSite?: string;
  paymentTerms?: string;
  items: DocumentLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountLabel?: string;
  discountAmount?: number;
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
  department,
  position,
  subject,
  constructionSite = "",
  paymentTerms = "",
  items,
  subtotal,
  taxAmount,
  totalAmount,
  discountLabel,
  discountAmount,
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
    <div className="print-area overflow-x-auto print:overflow-visible">
      <div className="document-preview document-page compact-print min-w-0 w-full overflow-visible rounded-2xl border border-zinc-200/80 bg-white px-4 py-6 font-sans shadow-sm shadow-zinc-900/[0.04] sm:px-8 sm:py-8 sm:pr-10">
      <DocumentHeader
        kind={kind}
        documentNumber={documentNumber}
        issueDate={issueDate}
        secondDate={secondDate}
        customerName={customerName}
        contactName={contactName}
        department={department}
        position={position}
      />

      <div className="document-intro mt-3 flex flex-col gap-4 overflow-visible sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="document-intro-left min-w-0 flex-1 sm:max-w-[48%]">
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
        discountLabel={discountLabel}
        discountAmount={discountAmount}
        memo={memo}
        memoTemplate={memoTemplate}
        company={company}
        bankAccounts={bankAccounts}
      />
      </div>
    </div>
  );
}
