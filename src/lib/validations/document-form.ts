import { z } from "zod";
import { DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE } from "@/lib/discount-totals";
import {
  hasNegativeLineItem,
  NEGATIVE_LINE_ITEM_MESSAGE,
} from "@/lib/validations/line-items";

export { discountFieldsSchema, discountFormDefaults } from "@/lib/validations/discount";

export function lineItemsSubtotal(
  items: Array<{ quantity: number; unitPrice: number }>
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

export function resolveDocumentSubtotal(args: {
  items: Array<{ quantity: number; unitPrice: number }>;
  amountExcludingTax?: number;
}): number {
  if (args.items.length > 0) {
    return lineItemsSubtotal(args.items);
  }
  return Math.max(0, args.amountExcludingTax ?? 0);
}

export function applyDocumentFormRefines<T extends z.ZodObject<z.ZodRawShape>>(
  schema: T,
  options?: { amountField?: "amount" }
) {
  const amountField = options?.amountField;

  return schema
    .refine(
      (data) =>
        !hasNegativeLineItem(
          (data.items ?? []) as Array<{ quantity: number; unitPrice: number }>
        ),
      { message: NEGATIVE_LINE_ITEM_MESSAGE, path: ["items"] }
    )
    .refine(
      (data) => {
        const subtotal = resolveDocumentSubtotal({
          items: (data.items ?? []) as Array<{ quantity: number; unitPrice: number }>,
          amountExcludingTax: amountField ? Number(data.amount ?? 0) : undefined,
        });
        return Number(data.discountAmount ?? 0) <= subtotal;
      },
      { message: DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE, path: ["discountAmount"] }
    );
}
