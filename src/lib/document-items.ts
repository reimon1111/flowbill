import type { DocumentLineItem } from "@/components/documents/document-items-table";

type ItemLike = {
  id: string;
  name: string;
  description?: string;
  width?: string;
  height?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
};

export function toDocumentLineItems(items: ItemLike[]): DocumentLineItem[] {
  return items.map((it) => ({
    id: it.id,
    name: it.name,
    description: it.description,
    width: it.width,
    height: it.height,
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    amount: it.amount,
  }));
}
