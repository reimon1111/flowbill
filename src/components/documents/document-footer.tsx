import { formatCurrency } from "@/lib/format";
import { resolveDocumentMemo } from "@/lib/document-memo";
import type { CompanySettings } from "@/lib/types";
import type { BankAccountDisplay } from "@/lib/services/bank-accounts";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import { DocumentBankInfo } from "@/components/documents/document-bank-info";

export function DocumentFooter({
  kind,
  subtotal,
  taxAmount,
  totalAmount,
  memo,
  memoTemplate,
  company,
  bankAccounts,
}: {
  kind: DocumentKind;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  memo: string;
  memoTemplate: string;
  company: CompanySettings;
  bankAccounts?: BankAccountDisplay[];
}) {
  const labels = getDocumentLabels(kind);
  const displayMemo = resolveDocumentMemo(memo, memoTemplate);

  return (
    <footer className="document-footer mt-4 space-y-3 text-[10px] leading-snug text-zinc-700">
      <div className="document-footer-totals ml-auto w-full max-w-[220px] border border-zinc-300">
        <div className="flex justify-between px-2 py-1">
          <span>小計</span>
          <span className="tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-200 px-2 py-1">
          <span>消費税</span>
          <span className="tabular-nums">{formatCurrency(Math.round(taxAmount))}</span>
        </div>
        <div className="flex justify-between border-t border-zinc-300 bg-zinc-50 px-2 py-1 font-medium text-zinc-900">
          <span>合計</span>
          <span className="tabular-nums">{formatCurrency(Math.round(totalAmount))}</span>
        </div>
      </div>

      {labels.showBankInfo ? (
        <DocumentBankInfo bankAccounts={bankAccounts} />
      ) : null}

      {displayMemo ? (
        <div className="document-memo max-w-xl">
          <p className="font-medium text-zinc-800">備考</p>
          <p className="mt-0.5 whitespace-pre-wrap">{displayMemo}</p>
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
