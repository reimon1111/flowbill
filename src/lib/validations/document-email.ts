import { z } from "zod";

export const documentEmailFieldSchema = z.object({
  documentEmail: z
    .string()
    .max(200, "メールアドレスは200文字以内で入力してください")
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "メール形式が正しくありません"
    ),
});

export const documentEmailFormDefaults = {
  documentEmail: "",
};

export const userDocumentEmailSchema = z
  .string()
  .max(200, "メールアドレスは200文字以内で入力してください")
  .refine(
    (v) => v === "" || z.string().email().safeParse(v).success,
    "メール形式が正しくありません"
  );
