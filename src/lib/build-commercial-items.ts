import type { CommercialDocumentItemInput } from "@/lib/commercial-document";
import type { InvoiceItemRecord, QuoteItemRecord } from "@/lib/types";
import type { ProjectItemRecord } from "@/lib/types";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import {
  calculateDocumentTotals,
  type DocumentDiscountFields,
} from "@/lib/discount-totals";

export function itemsFromQuoteItems(
  items: QuoteItemRecord[]
): CommercialDocumentItemInput[] {
  return items.map((it, idx) => ({
    itemTemplateId: it.itemTemplateId,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit || DEFAULT_UNIT,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
}

export function itemsFromInvoiceItems(
  items: InvoiceItemRecord[]
): CommercialDocumentItemInput[] {
  return items.map((it, idx) => ({
    itemTemplateId: null,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit || DEFAULT_UNIT,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
}

export function itemsFromProjectItems(
  items: ProjectItemRecord[]
): CommercialDocumentItemInput[] {
  return items.map((it, idx) => ({
    itemTemplateId: it.itemTemplateId,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit || DEFAULT_UNIT,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
}

export function computeCommercialTotals(
  items: Array<{ quantity: number; unitPrice: number; taxRate: number }>,
  discount?: Partial<DocumentDiscountFields> | null
) {
  const totals = calculateDocumentTotals(items, discount);
  return {
    subtotal: totals.subtotal,
    taxAmount: totals.taxAmount,
    totalAmount: totals.totalAmount,
  };
}
