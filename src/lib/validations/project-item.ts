import { z } from "zod";

const taxRateSchema = z.union([z.literal(0), z.literal(0.08), z.literal(0.1)]);

export const projectItemSchema = z.object({
  itemTemplateId: z.string().nullable(),
  name: z.string().min(1, "商品名を入力してください").max(100),
  description: z.string().max(300),
  width: z.string().max(50),
  height: z.string().max(50),
  quantity: z.number().min(0.01, "数量は0より大きく入力してください"),
  unit: z.string().min(1, "単位を入力してください").max(20),
  unitPrice: z.number().min(0, "単価は0円以上で入力してください"),
  taxRate: taxRateSchema,
  sortOrder: z.number().min(0),
});

export type ProjectItemFormValues = z.infer<typeof projectItemSchema>;
