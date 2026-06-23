"use client";

import { useMemo, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ItemTemplate, ItemTemplateCategory } from "@/lib/types";
import { ITEM_TEMPLATE_CATEGORIES } from "@/lib/types";
import { formatCurrency, formatTaxRate } from "@/lib/format";

export function ItemTemplatePicker({
  templates,
  onPick,
}: {
  templates: ItemTemplate[];
  onPick: (template: ItemTemplate) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ItemTemplateCategory | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates
      .filter((t) => {
        if (category !== "all" && t.category !== category) return false;
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name, "ja");
      });
  }, [templates, search, category]);

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-zinc-900">テンプレから追加</p>
        <span className="text-xs text-zinc-400">{templates.length}件</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="項目名・説明で検索..."
            className="h-10 rounded-xl border-zinc-200/80 bg-white pl-10 text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => {
            const v = e.target.value;
            setCategory(v === "all" ? "all" : (v as ItemTemplateCategory));
          }}
          className="h-10 rounded-xl border border-zinc-200/80 bg-white px-3 text-sm text-zinc-700"
        >
          <option value="all">すべて</option>
          {ITEM_TEMPLATE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {filtered.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="w-full rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-left transition-colors hover:bg-zinc-50"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-zinc-900">{t.name}</p>
                  {t.isFavorite && (
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                  )}
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {t.category}
                  </span>
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

        {filtered.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/30 px-4 py-10 text-center text-sm text-zinc-500">
            該当するテンプレがありません
          </div>
        )}
      </div>
    </div>
  );
}

