import { z } from "zod";

const taxRateSchema = z.union([z.literal(0), z.literal(0.08), z.literal(0.1)]);

export const recurringItemSchema = z.object({
  itemTemplateId: z.string().nullable(),
  name: z.string().min(1, "項目名を入力してください").max(100),
  description: z.string().max(300),
  quantity: z.number().min(1, "数量は1以上で入力してください"),
  unitPrice: z.number().min(0, "単価は0円以上で入力してください"),
  taxRate: taxRateSchema,
  sortOrder: z.number().min(0),
});

export const recurringFormSchema = z.object({
  customerId: z.string().min(1, "顧客を選択してください"),
  title: z.string().min(1, "タイトルを入力してください").max(100),
  billingDay: z
    .number()
    .min(1, "請求日は1〜28日で指定してください")
    .max(28, "請求日は1〜28日で指定してください"),
  nextBillingDate: z.string().min(1, "次回請求日を入力してください"),
  memo: z.string().max(500),
  items: z.array(recurringItemSchema).min(1, "明細を1件以上追加してください"),
});

export type RecurringFormValues = z.infer<typeof recurringFormSchema>;

export const recurringFormDefaults: RecurringFormValues = {
  customerId: "",
  title: "",
  billingDay: 25,
  nextBillingDate: "",
  memo: "",
  items: [],
};
