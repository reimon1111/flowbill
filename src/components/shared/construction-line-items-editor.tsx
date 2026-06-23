"use client";

import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { UnitSelect } from "@/components/shared/unit-select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

export type ConstructionLineItemDraft = {
  name: string;
  width: string;
  height: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  sortOrder: number;
};

type ConstructionLineItemsEditorProps<T extends ConstructionLineItemDraft> = {
  items: T[];
  onChange: (items: T[]) => void;
  onRemove: (index: number) => void;
  namePlaceholder?: string;
};

function parseQuantity(raw: string): number | null {
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

function parseUnitPrice(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  if (Number.isNaN(n)) return null;
  return n;
}

export function ConstructionLineItemsEditor<T extends ConstructionLineItemDraft>({
  items,
  onChange,
  onRemove,
  namePlaceholder = "商品名・品目",
}: ConstructionLineItemsEditorProps<T>) {
  const updateUnit = (index: number, unit: string) => {
    onChange(
      items.map((it, i) => {
        if (i !== index) return it;
        return { ...it, unit } as T;
      })
    );
  };

  const updateField = (
    index: number,
    patch: Partial<ConstructionLineItemDraft>
  ) => {
    onChange(
      items.map((it, i) => (i === index ? ({ ...it, ...patch } as T) : it))
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200/80 bg-white">
      <table className="min-w-[760px] w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-100 bg-zinc-50/80 text-left text-xs font-medium uppercase tracking-wider text-zinc-400">
            <th className="px-3 py-2.5 font-medium">商品名／品目</th>
            <th className="w-[72px] px-2 py-2.5 font-medium">W</th>
            <th className="w-[72px] px-2 py-2.5 font-medium">H</th>
            <th className="w-[72px] px-2 py-2.5 text-right font-medium">数量</th>
            <th className="w-[88px] px-2 py-2.5 font-medium">単位</th>
            <th className="w-[104px] px-2 py-2.5 text-right font-medium">単価</th>
            <th className="w-[104px] px-2 py-2.5 text-right font-medium">金額</th>
            <th className="w-10 px-1 py-2.5" aria-label="操作" />
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const amount = it.quantity * it.unitPrice;
            return (
              <tr
                key={it.sortOrder}
                className="border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50/40"
              >
                <td className="px-3 py-2 align-top">
                  <Input
                    value={it.name}
                    onChange={(e) => updateField(idx, { name: e.target.value })}
                    placeholder={namePlaceholder}
                    className={cn(cellInputClass, "min-w-[180px] font-medium")}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <Input
                    value={it.width}
                    onChange={(e) => updateField(idx, { width: e.target.value })}
                    placeholder="900"
                    className={cn(cellInputClass, "w-[68px] tabular-nums")}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <Input
                    value={it.height}
                    onChange={(e) => updateField(idx, { height: e.target.value })}
                    placeholder="1800"
                    className={cn(cellInputClass, "w-[68px] tabular-nums")}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <Input
                    type="number"
                    min={0.01}
                    step={0.01}
                    value={String(it.quantity)}
                    onChange={(e) => {
                      const n = parseQuantity(e.target.value);
                      if (n === null) return;
                      updateField(idx, { quantity: n });
                    }}
                    onBlur={(e) => {
                      const n = parseQuantity(e.target.value);
                      if (n === null || n === it.quantity) return;
                      updateField(idx, { quantity: n });
                    }}
                    className={cn(cellInputClass, "w-[68px] text-right tabular-nums")}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <UnitSelect
                    value={it.unit}
                    onChange={(unit) => updateUnit(idx, unit)}
                    compact
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={String(it.unitPrice)}
                    onChange={(e) => {
                      const n = parseUnitPrice(e.target.value);
                      if (n === null) return;
                      updateField(idx, { unitPrice: n });
                    }}
                    onBlur={(e) => {
                      const n = parseUnitPrice(e.target.value);
                      if (n === null || n === it.unitPrice) return;
                      updateField(idx, { unitPrice: n });
                    }}
                    className={cn(cellInputClass, "w-[96px] text-right tabular-nums")}
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <p className="flex h-9 items-center justify-end px-1 font-medium tabular-nums text-zinc-900">
                    {formatCurrency(amount)}
                  </p>
                </td>
                <td className="px-1 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => onRemove(idx)}
                    className="flex size-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    aria-label="明細を削除"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const cellInputClass =
  "h-9 rounded-lg border-zinc-200/80 px-2 text-sm shadow-none focus-visible:ring-zinc-300";
