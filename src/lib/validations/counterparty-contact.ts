import { z } from "zod";
import { EMPTY_COUNTERPARTY_CONTACT } from "@/lib/counterparty-contact";

export const counterpartyContactFieldsSchema = z.object({
  customerContactName: z
    .string()
    .max(100, "担当者名は100文字以内で入力してください"),
  customerDepartment: z
    .string()
    .max(100, "部署名は100文字以内で入力してください"),
  customerPosition: z
    .string()
    .max(100, "役職は100文字以内で入力してください"),
});

export type CounterpartyContactFormFields = z.infer<
  typeof counterpartyContactFieldsSchema
>;

export const counterpartyContactFormDefaults: CounterpartyContactFormFields = {
  ...EMPTY_COUNTERPARTY_CONTACT,
};
