import { z } from "zod";
import {
  discountFieldsSchema,
  discountFormDefaults,
  applyDocumentFormRefines,
} from "@/lib/validations/document-form";
import {
  counterpartyContactFieldsSchema,
  counterpartyContactFormDefaults,
} from "@/lib/validations/counterparty-contact";

const taxRateSchema = z.union([z.literal(0), z.literal(0.08), z.literal(0.1)]);

export const invoiceItemSchema = z.object({
  quoteItemId: z.string().nullable(),
  name: z.string().min(1, "項目名を入力してください").max(100),
  description: z.string().max(300),
  width: z.string().max(50),
  height: z.string().max(50),
  quantity: z.number().min(1, "数量は1以上で入力してください"),
  unit: z.string().min(1, "単位を入力してください").max(20),
  unitPrice: z.number().min(0, "単価は0円以上で入力してください"),
  taxRate: taxRateSchema,
  sortOrder: z.number().min(0),
});

export const invoiceFormSchema = applyDocumentFormRefines(
  z
    .object({
      projectId: z.string().min(1, "案件が指定されていません"),
      customerId: z.string().min(1, "顧客が指定されていません"),
      quoteId: z.string().min(1, "元見積が指定されていません"),
      issueDate: z.string().min(1, "発行日を入力してください"),
      dueDate: z.string().min(1, "支払期限を入力してください"),
      paymentTerms: z.string().max(200),
      bankAccountId: z.string().nullable().optional(),
      memo: z.string().max(500),
      items: z.array(invoiceItemSchema).min(1, "明細を1件以上追加してください"),
    })
    .merge(discountFieldsSchema)
    .merge(counterpartyContactFieldsSchema)
);

export type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export const invoiceFormDefaults: InvoiceFormValues = {
  projectId: "",
  customerId: "",
  quoteId: "",
  issueDate: "",
  dueDate: "",
  paymentTerms: "",
  bankAccountId: null,
  memo: "",
  items: [],
  ...discountFormDefaults,
  ...counterpartyContactFormDefaults,
};
