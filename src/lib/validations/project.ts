import { z } from "zod";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-utils";
import {
  hasZeroAmountLineItem,
  ZERO_LINE_ITEM_MESSAGE,
} from "@/lib/validations/line-items";
import { projectItemSchema } from "@/lib/validations/project-item";

const statusValues = PROJECT_STATUS_OPTIONS.map((o) => o.value) as [
  (typeof PROJECT_STATUS_OPTIONS)[number]["value"],
  ...(typeof PROJECT_STATUS_OPTIONS)[number]["value"][],
];

export const projectFormSchema = z.object({
  customerId: z.string().min(1, "顧客を選択してください"),
  projectName: z
    .string()
    .min(1, "案件名を入力してください")
    .max(200, "案件名は200文字以内で入力してください"),
  constructionSite: z.string().max(200, "工事場所は200文字以内で入力してください"),
  status: z.enum(statusValues),
  amount: z.number().min(0, "金額は0円以上で入力してください"),
  dueDate: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  assigneeName: z.string().max(50, "担当者名は50文字以内で入力してください"),
  memo: z.string().max(500, "メモは500文字以内で入力してください"),
  items: z.array(projectItemSchema),
})
  .refine(
    (data) => {
      if (!data.startDate || !data.endDate) return true;
      return data.endDate >= data.startDate;
    },
    { message: "完了予定日は開始日以降にしてください", path: ["endDate"] }
  )
  .refine(
    (data) => data.items.length === 0 || !hasZeroAmountLineItem(data.items),
    { message: ZERO_LINE_ITEM_MESSAGE, path: ["items"] }
  );

export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export const projectFormDefaults: ProjectFormValues = {
  customerId: "",
  projectName: "",
  constructionSite: "",
  status: "estimate",
  amount: 0,
  dueDate: "",
  startDate: "",
  endDate: "",
  assigneeName: "",
  memo: "",
  items: [],
};
