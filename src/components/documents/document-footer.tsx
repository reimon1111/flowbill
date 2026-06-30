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
      <table className="document-footer-totals ml-auto w-full max-w-[220px] border-collapse border border-zinc-300">
        <tbody>
          <tr className="document-footer-totals-row">
            <td className="px-2 py-1">小計</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {formatCurrency(subtotal)}
            </td>
          </tr>
          <tr className="document-footer-totals-row border-t border-zinc-200">
            <td className="px-2 py-1">消費税</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {formatCurrency(Math.round(taxAmount))}
            </td>
          </tr>
          <tr className="document-footer-totals-row border-t border-zinc-300 bg-zinc-50 font-medium text-zinc-900">
            <td className="px-2 py-1">合計</td>
            <td className="px-2 py-1 text-right tabular-nums">
              {formatCurrency(Math.round(totalAmount))}
            </td>
          </tr>
        </tbody>
      </table>

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
