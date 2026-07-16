import { z } from "zod";
import {
  CUSTOMER_HONORIFICS,
  DEFAULT_CUSTOMER_HONORIFIC,
} from "@/lib/customer-honorific";

export const customerHonorificFieldSchema = z.object({
  customerHonorific: z.enum(CUSTOMER_HONORIFICS, {
    message: "顧客敬称を選択してください",
  }),
});

export type CustomerHonorificFormFields = z.infer<
  typeof customerHonorificFieldSchema
>;

export const customerHonorificFormDefaults: CustomerHonorificFormFields = {
  customerHonorific: DEFAULT_CUSTOMER_HONORIFIC,
};
