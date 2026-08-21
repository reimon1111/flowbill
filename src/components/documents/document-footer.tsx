import { PrintableDocumentTotals } from "@/components/documents/printable-document-totals";
import { resolveDocumentMemo } from "@/lib/document-memo";
import {
  normalizeDocumentMemoFontSize,
  resolveDocumentMemoFontClass,
  type DocumentMemoFontSize,
} from "@/lib/document-memo-font-size";
import type { CompanySettings } from "@/lib/types";
import type { BankAccountDisplay } from "@/lib/services/bank-accounts";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import { DocumentBankInfo } from "@/components/documents/document-bank-info";
import { cn } from "@/lib/utils";

export function DocumentFooter({
  kind,
  subtotal,
  taxAmount,
  totalAmount,
  discountLabel,
  discountAmount,
  memo,
  memoTemplate,
  memoFontSize,
  company,
  bankAccounts,
}: {
  kind: DocumentKind;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountLabel?: string;
  discountAmount?: number;
  memo: string;
  memoTemplate: string;
  memoFontSize?: DocumentMemoFontSize | string | null;
  company: CompanySettings;
  bankAccounts?: BankAccountDisplay[];
}) {
  const labels = getDocumentLabels(kind);
  const displayMemo = resolveDocumentMemo(memo, memoTemplate);
  const memoBodyClass = resolveDocumentMemoFontClass(
    normalizeDocumentMemoFontSize(memoFontSize)
  );

  return (
    <footer className="document-footer mt-4 space-y-3 text-[10px] leading-snug text-zinc-700">
      <PrintableDocumentTotals
        subtotal={subtotal}
        taxAmount={taxAmount}
        totalAmount={totalAmount}
        discountLabel={discountLabel}
        discountAmount={discountAmount}
      />

      {labels.showBankInfo ? (
        <DocumentBankInfo bankAccounts={bankAccounts} />
      ) : null}

      {displayMemo ? (
        <div className="document-memo max-w-xl">
          <p className="font-medium text-zinc-800">備考</p>
          <p className={cn("mt-0.5 whitespace-pre-wrap", memoBodyClass)}>
            {displayMemo}
          </p>
        </div>
      ) : null}

      {company.signatureUrl ? (
        <div className="document-signature">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={company.signatureUrl}
            alt="署名"
            className="h-8 w-auto object-contain"
          />
        </div>
      ) : null}
    </footer>
  );
}
