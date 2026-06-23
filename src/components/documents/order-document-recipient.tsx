/** 注文書の宛先表示（空欄時は手書き用スペース） */
export function OrderDocumentRecipient({
  recipientName,
}: {
  recipientName: string;
}) {
  const trimmed = recipientName.trim();

  if (trimmed) {
    return (
      <p className="text-[15px] font-medium text-zinc-900">{trimmed}</p>
    );
  }

  return (
    <div
      className="document-order-recipient-blank min-h-[1.75em] min-w-[220px] max-w-[320px] border-b border-zinc-400"
      aria-label="宛名記入欄"
    />
  );
}
