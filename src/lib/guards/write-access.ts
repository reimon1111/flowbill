import { canWriteBusinessData } from "@/lib/types/company-membership";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";

export const VIEWER_WRITE_DENIED_MESSAGE =
  "閲覧のみの権限のため、この操作はできません。";

export function getCanWriteBusinessData(): boolean {
  return canWriteBusinessData(useCompanyMembershipStore.getState().currentRole);
}

export function assertCanWriteBusinessData(): void {
  if (!getCanWriteBusinessData()) {
    throw new Error(VIEWER_WRITE_DENIED_MESSAGE);
  }
}
