/**
 * 注文書・納品書・領収書ストアの共通ロジック（重複を抑えつつ型安全を維持）
 */
import type {
  CommercialDocumentItemInput,
  CommercialDocumentItemRecord,
  CommercialDocumentStatus,
} from "@/lib/commercial-document";
import { computeCommercialTotals } from "@/lib/build-commercial-items";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { normalizeUnit } from "@/lib/constants/units";
import { generateId } from "@/lib/db/ids";

export function nextCommercialNumber(
  prefix: string,
  issueDate: string,
  existingNumbers: string[]
): string {
  const y = issueDate.slice(0, 4);
  const head = `${prefix}-${y}-`;
  const count =
    existingNumbers.filter((n) => n.startsWith(head)).length + 1;
  return `${head}${String(count).padStart(4, "0")}`;
}

export function buildCommercialItemRecords<
  T extends CommercialDocumentItemRecord,
>(
  parentId: string,
  parentKey: keyof T,
  input: CommercialDocumentItemInput[],
  itemIdPrefix: string
): T[] {
  const now = new Date().toISOString();
  return input.map((it, idx) => {
    const amount = it.quantity * it.unitPrice;
    return {
      id: generateId(itemIdPrefix),
      [parentKey]: parentId,
      itemTemplateId: it.itemTemplateId,
      name: it.name,
      description: it.description,
      width: it.width ?? "",
      height: it.height ?? "",
      quantity: it.quantity,
      unit: normalizeUnit(it.unit || DEFAULT_UNIT),
      unitPrice: it.unitPrice,
      taxRate: it.taxRate,
      amount,
      sortOrder: it.sortOrder ?? idx,
      createdAt: now,
      updatedAt: now,
    } as T;
  });
}

export function totalsFromInput(items: CommercialDocumentItemInput[]) {
  return computeCommercialTotals(items);
}

export type CommercialHeaderFields = {
  projectId: string;
  customerId: string;
  issueDate: string;
  paymentTerms: string;
  memo: string;
  status: CommercialDocumentStatus;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
};

export function buildCommercialHeader(
  input: {
    projectId: string;
    customerId: string;
    issueDate: string;
    paymentTerms: string;
    memo: string;
  },
  items: CommercialDocumentItemInput[]
): Omit<CommercialHeaderFields, "createdAt" | "updatedAt" | "status"> & {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
} {
  const totals = totalsFromInput(items);
  return {
    projectId: input.projectId,
    customerId: input.customerId,
    issueDate: input.issueDate,
    paymentTerms: input.paymentTerms,
    memo: input.memo,
    ...totals,
  };
}
