import { z } from "zod";
import { quoteItemSchema } from "@/lib/validations/quote";
import {
  discountFieldsSchema,
  discountFormDefaults,
  applyDocumentFormRefines,
} from "@/lib/validations/document-form";
import {
  counterpartyContactFieldsSchema,
  counterpartyContactFormDefaults,
} from "@/lib/validations/counterparty-contact";
import {
  customerHonorificFieldSchema,
  customerHonorificFormDefaults,
} from "@/lib/validations/customer-honorific";

const commercialCoreFields = z.object({
  projectId: z.string().min(1, "案件が指定されていません"),
  customerId: z.string().min(1, "顧客が指定されていません"),
  issueDate: z.string().min(1, "発行日を入力してください"),
  paymentTerms: z.string().max(200),
  memo: z.string().max(500),
  items: z.array(quoteItemSchema).min(1, "明細を1件以上追加してください"),
});

/** 納品書・領収書（顧客敬称あり） */
export const commercialDocumentFormSchema = applyDocumentFormRefines(
  commercialCoreFields
    .merge(discountFieldsSchema)
    .merge(customerHonorificFieldSchema)
    .merge(counterpartyContactFieldsSchema)
);

export type CommercialDocumentFormValues = z.infer<
  typeof commercialDocumentFormSchema
>;

/** 注文書（顧客敬称なし・今回対象外） */
export const orderDocumentFormSchema = applyDocumentFormRefines(
  commercialCoreFields
    .extend({
      recipientName: z.string().max(200, "宛名は200文字以内で入力してください"),
    })
    .merge(discountFieldsSchema)
    .merge(counterpartyContactFieldsSchema)
);

export type OrderDocumentFormValues = z.infer<typeof orderDocumentFormSchema>;

export const commercialDocumentFormDefaults: CommercialDocumentFormValues = {
  projectId: "",
  customerId: "",
  issueDate: "",
  paymentTerms: "",
  memo: "",
  items: [],
  ...discountFormDefaults,
  ...customerHonorificFormDefaults,
  ...counterpartyContactFormDefaults,
};
