import { z } from "zod";

export const customerFormSchema = z.object({
  customerName: z
    .string()
    .min(1, "会社名を入力してください")
    .max(100, "会社名は100文字以内で入力してください"),
  contactName: z.string().max(50, "担当者名は50文字以内で入力してください"),
  email: z
    .string()
    .max(100)
    .refine(
      (val) => val === "" || z.string().email().safeParse(val).success,
      "メールアドレスの形式が正しくありません"
    ),
  phone: z.string().max(20, "電話番号は20文字以内で入力してください"),
  fax: z.string().max(20, "FAXは20文字以内で入力してください"),
  postalCode: z.string().max(10, "郵便番号は10文字以内で入力してください"),
  address: z.string().max(200, "住所は200文字以内で入力してください"),
  invoiceDestination: z
    .string()
    .max(100, "請求先名は100文字以内で入力してください"),
  memo: z.string().max(500, "メモは500文字以内で入力してください"),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

export const customerFormDefaults: CustomerFormValues = {
  customerName: "",
  contactName: "",
  email: "",
  phone: "",
  fax: "",
  postalCode: "",
  address: "",
  invoiceDestination: "",
  memo: "",
};
