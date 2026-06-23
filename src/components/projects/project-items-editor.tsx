"use client";

import { ConstructionLineItemsEditor } from "@/components/shared/construction-line-items-editor";
import type { ProjectItemFormValues } from "@/lib/validations/project-item";

export type ProjectItemDraft = ProjectItemFormValues;

export function ProjectItemsEditor({
  items,
  onChange,
  onRemove,
}: {
  items: ProjectItemDraft[];
  onChange: (items: ProjectItemDraft[]) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <ConstructionLineItemsEditor
      items={items}
      onChange={onChange}
      onRemove={onRemove}
      namePlaceholder="商品名・品目（必須）"
    />
  );
}
