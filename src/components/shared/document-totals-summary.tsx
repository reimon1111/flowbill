"use client";

import { formatCurrency } from "@/lib/format";
import {
  AFTER_DISCOUNT_SUBTOTAL_LABEL,
  calculateDocumentTotals,
  discountDisplayLabel,
  type DocumentDiscountFields,
  type LineForDocumentTotals,
} from "@/lib/discount-totals";
import { cn } from "@/lib/utils";

type DocumentTotalsSummaryProps = {
  items: LineForDocumentTotals[];
  discount?: DocumentDiscountFields;
  className?: string;
  compact?: boolean;
};

function Row({
  label,
  value,
  strong,
  negative,
}: {
  label: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        strong && "font-semibold text-zinc-900"
      )}
    >
      <span className={cn("text-zinc-600", strong && "text-zinc-900")}>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          negative && "text-zinc-700",
          strong && "text-zinc-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function DocumentTotalsSummary({
  items,
  discount,
  className,
  compact,
}: DocumentTotalsSummaryProps) {
  const totals = calculateDocumentTotals(items, discount);
  const showDiscount = totals.discountAmount > 0;

  return (
    <div className={cn("space-y-2 text-sm", className)}>
      <Row label="小計" value={formatCurrency(Math.round(totals.subtotal))} />
      {showDiscount ? (
        <>
          <Row
            label={discountDisplayLabel(totals.discountLabel)}
            value={`-${formatCurrency(Math.round(totals.discountAmount))}`}
            negative
          />
          <Row
            label={AFTER_DISCOUNT_SUBTOTAL_LABEL}
            value={formatCurrency(Math.round(totals.taxableAmount))}
          />
        </>
      ) : null}
      <Row
        label="消費税"
        value={formatCurrency(Math.round(totals.taxAmount))}
      />
      <div className={cn(!compact && "border-t border-zinc-100 pt-3")}>
        <Row
          label="合計"
          value={formatCurrency(Math.round(totals.totalAmount))}
          strong
        />
      </div>
    </div>
  );
}

export function useDocumentTotals(
  items: LineForDocumentTotals[],
  discount?: DocumentDiscountFields
) {
  return calculateDocumentTotals(items, discount);
}
