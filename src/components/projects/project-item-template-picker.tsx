"use client";

import { ItemTemplatePicker } from "@/components/quotes/item-template-picker";
import type { ItemTemplate } from "@/lib/types";

export function ProjectItemTemplatePicker({
  templates,
  onPick,
}: {
  templates: ItemTemplate[];
  onPick: (template: ItemTemplate) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-500">
        よく使う商品・サービスは請求項目テンプレに登録できます。選択すると案件明細に追加されます。
      </p>
      <ItemTemplatePicker templates={templates} onPick={onPick} />
    </div>
  );
}
