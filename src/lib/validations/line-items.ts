import { NEGATIVE_LINE_ITEM_MESSAGE } from "@/lib/discount-totals";

/** 明細行にマイナス単価・マイナス金額が含まれるか */
export function hasNegativeLineItem(
  items: Array<{ quantity: number; unitPrice: number }>
): boolean {
  return items.some(
    (it) => it.unitPrice < 0 || it.quantity * it.unitPrice < 0
  );
}

export { NEGATIVE_LINE_ITEM_MESSAGE };
