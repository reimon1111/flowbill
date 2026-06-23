"use client";

import { ConstructionLineItemsEditor } from "@/components/shared/construction-line-items-editor";

export type QuoteItemDraft = {
  itemTemplateId: string | null;
  name: string;
  description: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  taxRate: 0 | 0.08 | 0.1;
  sortOrder: number;
};

export function QuoteItemsEditor({
  items,
  onChange,
  onRemove,
}: {
  items: QuoteItemDraft[];
  onChange: (items: QuoteItemDraft[]) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ConstructionLineItemsEditor
      items={items}
      onChange={onChange}
      onRemove={onRemove}
    />
  );
}
