import type { ProjectItemRecord } from "@/lib/types";
import {
  getProjectTotalWithTaxFromParts,
  type DocumentDiscountFields,
} from "@/lib/discount-totals";

/** 案件のユーザー向け表示金額（値引き後税込） */
export function getProjectTotalWithTax(
  projectId: string,
  amountExcludingTax: number,
  projectItems: ProjectItemRecord[],
  discount?: Partial<DocumentDiscountFields> | null
): number {
  const items = projectItems.filter((i) => i.projectId === projectId);
  return getProjectTotalWithTaxFromParts({
    items,
    amountExcludingTax,
    discount,
  });
}
