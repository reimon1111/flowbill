/** 書類全体の値引き（固定金額） */

export type DocumentDiscountFields = {
  discountLabel: string;
  discountAmount: number;
};

export const EMPTY_DOCUMENT_DISCOUNT: DocumentDiscountFields = {
  discountLabel: "",
  discountAmount: 0,
};

export type LineForDocumentTotals = {
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  taxRate: number;
};

export type DocumentTotals = {
  subtotal: number;
  discountLabel: string;
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export const DISCOUNT_LABEL_FALLBACK = "値引き";

/** 帳票集計欄: 値引き後の税抜小計 */
export const AFTER_DISCOUNT_SUBTOTAL_LABEL = "値引後小計（税抜）";

export const DISCOUNT_AMOUNT_MIN_MESSAGE =
  "値引き額は0円以上で入力してください。";
export const DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE =
  "値引き額は小計を超えて設定できません。";
export const NEGATIVE_LINE_ITEM_MESSAGE =
  "値引きは商品明細ではなく、値引き欄から入力してください。";

export function discountDisplayLabel(label: string | null | undefined): string {
  const trimmed = label?.trim();
  return trimmed ? trimmed : DISCOUNT_LABEL_FALLBACK;
}

export function normalizeDocumentDiscount(
  discount?: Partial<DocumentDiscountFields> | null
): DocumentDiscountFields {
  const discountAmount = Math.max(0, Math.round(discount?.discountAmount ?? 0));
  return {
    discountLabel: discount?.discountLabel?.trim() ?? "",
    discountAmount,
  };
}

export function pickDocumentDiscount(
  source?: Partial<DocumentDiscountFields> | null
): DocumentDiscountFields {
  return normalizeDocumentDiscount(source);
}

/**
 * 書類引き継ぎ用: 元書類に値引きがあればそれを使い、なければフォールバック（案件など）を使う。
 */
export function resolveInheritedDiscount(
  primary?: Partial<DocumentDiscountFields> | null,
  fallback?: Partial<DocumentDiscountFields> | null
): DocumentDiscountFields {
  const fromPrimary = normalizeDocumentDiscount(primary);
  if (fromPrimary.discountAmount > 0 || fromPrimary.discountLabel.length > 0) {
    return fromPrimary;
  }
  return normalizeDocumentDiscount(fallback);
}

/** 明細行の税抜金額 */
export function resolveLineAmount(item: LineForDocumentTotals): number {
  if (typeof item.amount === "number") return item.amount;
  const quantity = item.quantity ?? 0;
  const unitPrice = item.unitPrice ?? 0;
  return quantity * unitPrice;
}

/**
 * 書類合計を計算する。
 * 値引きは税率グループごとに税抜小計へ按分し、按分後の課税対象額に税率を適用する。
 */
export function calculateDocumentTotals(
  items: LineForDocumentTotals[],
  discount?: Partial<DocumentDiscountFields> | null
): DocumentTotals {
  const normalizedDiscount = normalizeDocumentDiscount(discount);
  const subtotal = items.reduce((sum, item) => sum + resolveLineAmount(item), 0);

  const discountAmount = Math.min(normalizedDiscount.discountAmount, subtotal);
  const taxableAmount = subtotal - discountAmount;

  const buckets = new Map<number, number>();
  for (const item of items) {
    const amount = resolveLineAmount(item);
    buckets.set(item.taxRate, (buckets.get(item.taxRate) ?? 0) + amount);
  }

  let taxAmount = 0;
  if (subtotal > 0) {
    for (const [taxRate, bucketSubtotal] of buckets) {
      const bucketDiscount = discountAmount * (bucketSubtotal / subtotal);
      const bucketTaxable = bucketSubtotal - bucketDiscount;
      taxAmount += bucketTaxable * taxRate;
    }
  }

  const totalAmount = taxableAmount + taxAmount;

  return {
    subtotal,
    discountLabel: normalizedDiscount.discountLabel,
    discountAmount,
    taxableAmount,
    taxAmount,
    totalAmount,
  };
}

export function hasNegativeLineItemAmount(
  items: Array<{ quantity: number; unitPrice: number }>
): boolean {
  return items.some(
    (item) => item.unitPrice < 0 || item.quantity * item.unitPrice < 0
  );
}

export function validateDocumentDiscount(
  subtotal: number,
  discount?: Partial<DocumentDiscountFields> | null
): string | null {
  const normalized = normalizeDocumentDiscount(discount);
  if (normalized.discountAmount < 0) {
    return DISCOUNT_AMOUNT_MIN_MESSAGE;
  }
  if (normalized.discountAmount > subtotal) {
    return DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE;
  }
  const totals = calculateDocumentTotals(
    [{ quantity: 1, unitPrice: subtotal, taxRate: 0 }],
    normalized
  );
  if (totals.taxableAmount < 0 || totals.totalAmount < 0) {
    return DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE;
  }
  return null;
}

/** 案件表示用: 明細または amount（税抜）から値引き後税込合計 */
export function getProjectTotalWithTaxFromParts(args: {
  items: LineForDocumentTotals[];
  amountExcludingTax: number;
  discount?: Partial<DocumentDiscountFields> | null;
}): number {
  const { items, amountExcludingTax, discount } = args;
  if (items.length > 0) {
    return Math.round(calculateDocumentTotals(items, discount).totalAmount);
  }
  if (amountExcludingTax <= 0) return 0;
  return Math.round(
    calculateDocumentTotals(
      [{ quantity: 1, unitPrice: amountExcludingTax, taxRate: 0.1 }],
      discount
    ).totalAmount
  );
}
