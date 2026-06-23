import { formatCurrency } from "@/lib/format";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";

export function DocumentSummary({
  kind,
  totalAmount,
}: {
  kind: DocumentKind;
  totalAmount: number;
}) {
  const labels = getDocumentLabels(kind);

  if (labels.showReceiptStamp) {
    return (
      <div className="document-summary mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base font-bold text-zinc-900">{labels.totalLabel}</span>
            <span className="text-3xl font-bold tabular-nums tracking-wide text-zinc-900">
              {formatCurrency(Math.round(totalAmount))}
            </span>
          </div>
          <div className="document-summary-rule mt-1 max-w-md border-b-2 border-zinc-900" />
        </div>
        <div
          className="document-revenue-stamp shrink-0 border border-zinc-400 px-4 py-6 text-center text-xs text-zinc-500"
          aria-hidden
        >
          収入印紙
        </div>
      </div>
    );
  }

  return (
    <div className="document-summary mt-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-base font-bold text-zinc-900">{labels.totalLabel}</span>
        <span className="text-2xl font-bold tabular-nums tracking-wide text-zinc-900">
          {formatCurrency(Math.round(totalAmount))}
        </span>
      </div>
      <div className="document-summary-rule mt-1 max-w-md border-b-2 border-zinc-900" />
    </div>
  );
}
