import { z } from "zod";
export const itemTemplateFormSchema = z.object({
  name: z
    .string()
    .min(1, "項目名を入力してください")
    .max(100, "項目名は100文字以内で入力してください"),
  category: z.string().min(1, "カテゴリを選択してください").max(30, "カテゴリは30文字以内で入力してください"),
  description: z.string().max(300, "説明は300文字以内で入力してください"),
  unitPrice: z
    .number({ message: "単価は数値で入力してください" })
    .min(0, "単価は0円以上で入力してください"),
  taxRate: z.union([z.literal(10), z.literal(8), z.literal(0)], {
    message: "税率を選択してください",
  }),
  isFavorite: z.boolean(),
});

export type ItemTemplateFormValues = z.infer<typeof itemTemplateFormSchema>;

export const itemTemplateFormDefaults: ItemTemplateFormValues = {
  name: "",
  category: "制作",
  description: "",
  unitPrice: 0,
  taxRate: 10,
  isFavorite: false,
};
