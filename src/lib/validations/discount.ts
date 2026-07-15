import { z } from "zod";
import {
  DISCOUNT_AMOUNT_MIN_MESSAGE,
  DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE,
} from "@/lib/discount-totals";

export const discountFieldsSchema = z.object({
  discountLabel: z.string().max(100, "値引き名は100文字以内で入力してください"),
  discountAmount: z
    .number()
    .min(0, DISCOUNT_AMOUNT_MIN_MESSAGE)
    .max(999_999_999, "値引き額が大きすぎます"),
});

export type DiscountFormFields = z.infer<typeof discountFieldsSchema>;

export const discountFormDefaults: DiscountFormFields = {
  discountLabel: "",
  discountAmount: 0,
};

export function refineDiscountAgainstSubtotal<T extends DiscountFormFields>(
  data: T,
  subtotal: number
) {
  if (data.discountAmount > subtotal) {
    return {
      ok: false as const,
      message: DISCOUNT_EXCEEDS_SUBTOTAL_MESSAGE,
    };
  }
  return { ok: true as const };
}
