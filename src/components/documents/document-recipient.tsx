import { formatDocumentRecipient } from "@/lib/format-contact";

export function DocumentRecipient({
  customerName,
  contactName,
}: {
  customerName: string;
  contactName?: string;
}) {
  const recipient = formatDocumentRecipient(customerName, contactName);

  return (
    <div className="document-customer min-w-0 flex-1">
      <p className="text-[15px] font-medium text-zinc-900">{recipient.primaryLine}</p>
      <div className="document-customer-rule mt-1.5 max-w-[280px] border-b border-zinc-400" />
      {recipient.contactLine ? (
        <p className="mt-1 text-[11px] text-zinc-800">{recipient.contactLine}</p>
      ) : null}
    </div>
  );
}
