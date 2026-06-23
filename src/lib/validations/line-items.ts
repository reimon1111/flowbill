/** 明細行に単価0・金額0が含まれるか */
export function hasZeroAmountLineItem(
  items: Array<{ quantity: number; unitPrice: number }>
): boolean {
  return items.some(
    (it) => it.unitPrice <= 0 || it.quantity * it.unitPrice <= 0
  );
}

export const ZERO_LINE_ITEM_MESSAGE =
  "単価または金額が0円の明細があります";
