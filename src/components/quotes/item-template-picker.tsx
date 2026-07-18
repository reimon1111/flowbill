"use client";

import { useMemo } from "react";
import { Plus, Star } from "lucide-react";
import type { ItemTemplate } from "@/lib/types";
import { formatCurrency, formatTaxRate } from "@/lib/format";

/** 商品明細テンプレから追加（一覧のみ。検索・カテゴリ UI なし） */
export function ItemTemplatePicker({
  templates,
  onPick,
}: {
  templates: ItemTemplate[];
  onPick: (template: ItemTemplate) => void;
}) {
  const sorted = useMemo(
    () =>
      [...templates].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name, "ja");
      }),
    [templates]
  );

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-900">テンプレから追加</p>
        <span className="text-xs text-zinc-400">{sorted.length}件</span>
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
        {sorted.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="w-full rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-zinc-900">{t.name}</p>
                  {t.isFavorite && (
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 line-clamp-1 text-sm text-zinc-500">
                    {t.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-zinc-900">
                  {formatCurrency(t.unitPrice)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {formatTaxRate(t.taxRate)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400">
              <Plus className="size-3.5" />
              選択して明細に追加
            </div>
          </button>
        ))}

        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-4 py-10 text-center text-sm text-zinc-500">
            テンプレがありません
          </div>
        )}
      </div>
    </div>
  );
}
