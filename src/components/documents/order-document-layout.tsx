"use client";

import { formatDate } from "@/lib/format";
import type { DocumentLayoutProps } from "@/components/documents/document-layout";
import { DocumentFooter } from "@/components/documents/document-footer";
import {
  DocumentItemsTable,
} from "@/components/documents/document-items-table";
import { DocumentPaymentTerms } from "@/components/documents/document-payment-terms";
import { DocumentPurchaserInfo } from "@/components/documents/document-purchaser-info";
import { DocumentSummary } from "@/components/documents/document-summary";
import { OrderDocumentRecipient } from "@/components/documents/order-document-recipient";
import { getDocumentLabels } from "@/components/documents/document-labels";

type OrderDocumentLayoutProps = Omit<
  DocumentLayoutProps,
  | "kind"
  | "customerName"
  | "contactName"
  | "department"
  | "position"
  | "secondDate"
  | "bankAccounts"
> & {
  recipientName?: string;
};

/**
 * 注文書専用レイアウト。
 * 相手業者 → 自社 への発注書として、宛名・発注者欄の向きを反転する。
 * 先方担当者（customer_contact_*）は帳票には表示しない。
 */
export function OrderDocumentLayout({
  documentNumber,
  issueDate,
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
  recipientName = "",
}: OrderDocumentLayoutProps) {
  const labels = getDocumentLabels("order");
  const subjectText = subject.trim()
    ? `件名：${subject.trim()}${labels.subjectSuffix}`
    : "";

  return (
    <div className="print-area overflow-x-auto print:overflow-visible">
      <div className="document-preview document-page order-document-layout compact-print min-w-0 w-full overflow-visible rounded-2xl border border-zinc-200/80 bg-white px-4 py-6 font-sans shadow-sm shadow-zinc-900/[0.04] sm:px-8 sm:py-8 sm:pr-10">
      <div className="document-header">
        <h1 className="document-title text-center text-2xl font-bold tracking-[0.25em] text-zinc-900">
          {labels.title}
        </h1>
        <div className="document-title-rule mt-2 border-b border-zinc-900" />

        <div className="document-header-body mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="document-order-recipient min-w-0 flex-1">
            <div className="flex items-start gap-3">
              {company.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={company.logoUrl}
                  alt="ロゴ"
                  className="document-order-logo h-auto max-h-14 w-auto max-w-[120px] shrink-0 object-contain"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <OrderDocumentRecipient recipientName={recipientName} />
              </div>
            </div>
          </div>

          <div className="document-meta shrink-0 text-right text-xs leading-relaxed text-zinc-800">
            <p>
              <span className="inline-block w-[4.5em] text-left">{labels.numberLabel}</span>
              <span className="tabular-nums">{documentNumber}</span>
            </p>
            <p>
              <span className="inline-block w-[4.5em] text-left">発行日</span>
              <span>{formatDate(issueDate)}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="document-intro mt-3 flex flex-col gap-4 overflow-visible sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="document-intro-left min-w-0 flex-1 sm:max-w-[48%]">
          {subjectText ? (
            <p className="document-subject text-[13px] text-zinc-900">{subjectText}</p>
          ) : null}
          {constructionSite.trim() ? (
            <p className="document-construction-site mt-0.5 text-[13px] text-zinc-900">
              工事場所：{constructionSite.trim()}
            </p>
          ) : null}
          <p className="document-greeting mt-1 text-[13px] text-zinc-800">
            {labels.greeting}
          </p>
          <DocumentPaymentTerms paymentTerms={paymentTerms} />
          <DocumentSummary kind="order" totalAmount={totalAmount} />
        </div>
        <DocumentPurchaserInfo />
      </div>

      <DocumentItemsTable items={items} />

      <DocumentFooter
        kind="order"
        subtotal={subtotal}
        taxAmount={taxAmount}
        totalAmount={totalAmount}
        discountLabel={discountLabel}
        discountAmount={discountAmount}
        memo={memo}
        memoTemplate={memoTemplate}
        company={company}
      />
      </div>
    </div>
  );
}
