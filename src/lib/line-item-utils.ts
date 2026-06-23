/** 明細行の税抜金額 */
export function lineItemAmount(quantity: number, unitPrice: number): number {
  return Math.round(quantity * unitPrice);
}

/** 明細配列の税抜合計 */
export function sumLineItemAmounts(
  items: Array<{ quantity: number; unitPrice: number }>
): number {
  return items.reduce((s, it) => s + lineItemAmount(it.quantity, it.unitPrice), 0);
}
