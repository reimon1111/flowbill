/** 顧客宛名の敬称（案件・見積・納品・請求・領収のスナップショット） */

export const CUSTOMER_HONORIFICS = ["御中", "様"] as const;

export type CustomerHonorific = (typeof CUSTOMER_HONORIFICS)[number];

export const DEFAULT_CUSTOMER_HONORIFIC: CustomerHonorific = "御中";

export const CUSTOMER_HONORIFIC_OPTIONS: Array<{
  value: CustomerHonorific;
  label: string;
}> = [
  { value: "御中", label: "御中" },
  { value: "様", label: "様" },
];

export function isCustomerHonorific(value: unknown): value is CustomerHonorific {
  return (
    typeof value === "string" &&
    (CUSTOMER_HONORIFICS as readonly string[]).includes(value)
  );
}

export function normalizeCustomerHonorific(
  value?: string | null
): CustomerHonorific {
  if (isCustomerHonorific(value?.trim())) {
    return value.trim() as CustomerHonorific;
  }
  return DEFAULT_CUSTOMER_HONORIFIC;
}

export function pickCustomerHonorific(
  source?: { customerHonorific?: string | null } | null
): CustomerHonorific {
  return normalizeCustomerHonorific(source?.customerHonorific);
}
