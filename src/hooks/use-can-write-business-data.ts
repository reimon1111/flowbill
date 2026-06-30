"use client";

import { canWriteBusinessData } from "@/lib/types/company-membership";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";

export function useCanWriteBusinessData(): boolean {
  const role = useCompanyMembershipStore((s) => s.currentRole);
  return canWriteBusinessData(role);
}
