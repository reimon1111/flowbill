import { formatDate } from "@/lib/format";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import { DocumentRecipient } from "@/components/documents/document-recipient";

export function DocumentHeader({
  kind,
  documentNumber,
  issueDate,
  secondDate,
  customerName,
  contactName,
  department,
  position,
}: {
  kind: DocumentKind;
  documentNumber: string;
  issueDate: string;
  secondDate?: string;
  customerName: string;
  contactName?: string;
  department?: string;
  position?: string;
}) {
  const labels = getDocumentLabels(kind);

  return (
    <div className="document-header">
      <h1 className="document-title text-center text-2xl font-bold tracking-[0.25em] text-zinc-900">
        {labels.title}
      </h1>
      <div className="document-title-rule mt-2 border-b border-zinc-900" />

      <div className="document-header-body mt-4 flex items-start justify-between gap-6">
        <DocumentRecipient
          customerName={customerName}
          contactName={contactName}
          department={department}
          position={position}
        />

        <div className="document-meta shrink-0 text-right text-xs leading-relaxed text-zinc-800">
          <p>
            <span className="inline-block w-[4.5em] text-left">{labels.numberLabel}</span>
            <span className="tabular-nums">{documentNumber}</span>
          </p>
          <p>
            <span className="inline-block w-[4.5em] text-left">発行日</span>
            <span>{formatDate(issueDate)}</span>
          </p>
          {labels.secondDateLabel && secondDate ? (
            <p>
              <span className="inline-block w-[4.5em] text-left">
                {labels.secondDateLabel}
              </span>
              <span>{formatDate(secondDate)}</span>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
