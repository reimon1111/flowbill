export function DocumentPaymentTerms({ paymentTerms }: { paymentTerms: string }) {
  const text = paymentTerms.trim();
  if (!text) return null;

  return (
    <div className="document-payment-terms mt-2 text-[11px] text-zinc-800">
      <p className="font-medium text-zinc-900">支払い条件</p>
      <p className="mt-0.5">{text}</p>
    </div>
  );
}
