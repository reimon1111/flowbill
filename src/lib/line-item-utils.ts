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

/** 明細配列の税込合計（taxRate は 0 / 0.08 / 0.1 の小数） */
export function sumLineItemsWithTax(
  items: Array<{ quantity: number; unitPrice: number; taxRate: number }>
): number {
  let subtotal = 0;
  let tax = 0;
  for (const it of items) {
    const amount = lineItemAmount(it.quantity, it.unitPrice);
    subtotal += amount;
    tax += Math.round(amount * it.taxRate);
  }
  return subtotal + tax;
}
