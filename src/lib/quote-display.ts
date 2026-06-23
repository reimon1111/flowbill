import type { QuoteItemRecord, QuoteRecord } from "@/lib/types";

/** 一覧表示用：ストアの合計が0でも明細から算出 */
export function getQuoteDisplayTotal(
  quote: Pick<QuoteRecord, "totalAmount">,
  items: QuoteItemRecord[]
): number {
  if (quote.totalAmount > 0) return Math.round(quote.totalAmount);
  if (items.length === 0) return 0;

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const taxAmount = items.reduce((s, i) => s + i.amount * i.taxRate, 0);
  return Math.round(subtotal + taxAmount);
}
