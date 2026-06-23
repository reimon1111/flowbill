import { z } from "zod";
import { QUOTE_EXPIRY_PERIOD_TYPES } from "@/lib/quote-expiry";

export const companySettingsSchema = z.object({
  companyName: z.string().min(1, "会社名を入力してください").max(100),
  postalCode: z.string().max(20),
  address: z.string().max(200),
  phone: z.string().max(30),
  fax: z.string().max(30),
  contactName: z.string().max(50),
  email: z
    .string()
    .max(200)
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "メール形式が正しくありません"
    ),
  invoiceNumber: z.string().max(50),
  bankName: z.string().max(100),
  bankBranch: z.string().max(100),
  bankAccountType: z.string().max(30),
  bankAccountNumber: z.string().max(30),
  bankAccountHolder: z.string().max(100),
  logoUrl: z.string().nullable(),
  stampUrl: z.string().nullable(),
  signatureUrl: z.string().nullable(),
  quoteDefaultExpiryType: z.enum(QUOTE_EXPIRY_PERIOD_TYPES),
  paymentTerms: z.string().max(200),
  quoteMemoTemplate: z.string().max(2000),
  invoiceMemoTemplate: z.string().max(2000),
  orderMemoTemplate: z.string().max(2000),
  deliveryNoteMemoTemplate: z.string().max(2000),
  receiptMemoTemplate: z.string().max(2000),
});

export type CompanySettingsFormValues = z.infer<typeof companySettingsSchema>;
