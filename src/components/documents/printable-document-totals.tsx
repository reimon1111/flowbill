import { formatCurrency } from "@/lib/format";
import {
  AFTER_DISCOUNT_SUBTOTAL_LABEL,
  discountDisplayLabel,
} from "@/lib/discount-totals";
import { cn } from "@/lib/utils";

export type PrintableDocumentTotalsProps = {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountLabel?: string;
  discountAmount?: number;
  className?: string;
};

/**
 * 帳票・PDF用の金額集計（全書類共通）。
 *
 * 値引きなし: 小計 → 消費税 → 合計
 * 値引きあり: 小計 → 値引き → 値引後小計（税抜） → 消費税 → 合計
 */
export function PrintableDocumentTotals({
  subtotal,
  taxAmount,
  totalAmount,
  discountLabel,
  discountAmount,
  className,
}: PrintableDocumentTotalsProps) {
  const roundedSubtotal = Math.round(subtotal);
  const discount = Math.max(0, Math.round(discountAmount ?? 0));
  const showDiscount = discount > 0;
  const afterDiscountSubtotal = roundedSubtotal - discount;

  return (
    <table
      className={cn(
        "document-footer-totals ml-auto w-full max-w-[260px] border-collapse border border-zinc-300",
        className
      )}
    >
      <tbody>
        <tr className="document-footer-totals-row">
          <td className="px-2 py-1">小計</td>
          <td className="px-2 py-1 text-right tabular-nums">
            {formatCurrency(roundedSubtotal)}
          </td>
        </tr>
        {showDiscount ? (
          <>
            <tr className="document-footer-totals-row border-t border-zinc-200">
              <td className="px-2 py-1">
                {discountDisplayLabel(discountLabel)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                -{formatCurrency(discount)}
              </td>
            </tr>
            <tr className="document-footer-totals-row border-t border-zinc-200">
              <td className="px-2 py-1">{AFTER_DISCOUNT_SUBTOTAL_LABEL}</td>
              <td className="px-2 py-1 text-right tabular-nums">
                {formatCurrency(afterDiscountSubtotal)}
              </td>
            </tr>
          </>
        ) : null}
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
  );
}
