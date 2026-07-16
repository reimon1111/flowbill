import { formatDocumentRecipient } from "@/lib/format-contact";
import type { CustomerHonorific } from "@/lib/customer-honorific";

export function DocumentRecipient({
  customerName,
  contactName,
  department,
  position,
  honorific,
}: {
  customerName: string;
  contactName?: string;
  department?: string;
  position?: string;
  honorific?: CustomerHonorific | string | null;
}) {
  const recipient = formatDocumentRecipient(customerName, contactName, {
    department,
    position,
    honorific,
  });

  return (
    <div className="document-customer min-w-0 flex-1">
      {recipient.companyLine ? (
        <p className="text-[15px] font-medium text-zinc-900">
          {recipient.companyLine}
        </p>
      ) : null}
      <div className="document-customer-rule mt-1.5 max-w-[280px] border-b border-zinc-400" />
      {recipient.orgLines.map((line) => (
        <p key={line} className="mt-1 text-[11px] leading-snug text-zinc-800">
          {line}
        </p>
      ))}
      {recipient.contactLine ? (
        <p
          className={
            recipient.orgLines.length > 0
              ? "mt-0.5 text-[11px] leading-snug text-zinc-800"
              : "mt-1 text-[11px] leading-snug text-zinc-800"
          }
        >
          {recipient.contactLine}
        </p>
      ) : null}
    </div>
  );
}
