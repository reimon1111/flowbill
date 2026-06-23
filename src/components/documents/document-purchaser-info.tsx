/** 注文書：相手業者（発注者）が記入する欄 */
export function DocumentPurchaserInfo() {
  const fields = [
    { label: "会社名", className: "col-span-2" },
    { label: "住所", className: "col-span-2" },
    { label: "TEL", className: "" },
    { label: "FAX", className: "" },
    { label: "担当者", className: "col-span-2" },
  ] as const;

  return (
    <div className="document-purchaser-info ml-auto w-[46%] max-w-[400px] shrink-0 rounded-sm border border-zinc-300 bg-zinc-50/30 p-3 text-[11px] leading-snug text-zinc-800">
      <p className="mb-2.5 text-xs font-semibold text-zinc-900">発注者情報</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {fields.map(({ label, className }) => (
          <div key={label} className={`flex items-end gap-1.5 ${className}`}>
            <span className="shrink-0 text-zinc-600">{label}：</span>
            <span
              className="document-purchaser-field min-h-[1.35em] flex-1 border-b border-zinc-300 bg-white/60"
              aria-hidden
            />
          </div>
        ))}
      </div>
    </div>
  );
}
