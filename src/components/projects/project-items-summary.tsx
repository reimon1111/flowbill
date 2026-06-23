"use client";

import { formatCurrency } from "@/lib/format";
import { normalizeUnit } from "@/lib/constants/units";
import { sumLineItemAmounts } from "@/lib/line-item-utils";
import type { ProjectItemRecord } from "@/lib/types";

export function ProjectItemsSummary({ items }: { items: ProjectItemRecord[] }) {
  const subtotal = sumLineItemAmounts(items);

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">商品明細はまだ登録されていません。</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-zinc-200/80">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[1fr_56px_56px_56px_48px_88px_96px] gap-2 bg-zinc-50 px-4 py-2.5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <span>商品名／品目</span>
            <span className="text-center">W</span>
            <span className="text-center">H</span>
            <span className="text-right">数量</span>
            <span>単位</span>
            <span className="text-right">単価</span>
            <span className="text-right">金額</span>
          </div>
          <div className="divide-y divide-zinc-100 bg-white">
            {items.map((it) => (
              <div
                key={it.id}
                className="grid grid-cols-[1fr_56px_56px_56px_48px_88px_96px] gap-2 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{it.name}</p>
                  {it.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500">
                      {it.description}
                    </p>
                  ) : null}
                </div>
                <p className="text-center tabular-nums text-zinc-700">{it.width || ""}</p>
                <p className="text-center tabular-nums text-zinc-700">{it.height || ""}</p>
                <p className="text-right tabular-nums text-zinc-700">{it.quantity}</p>
                <p className="text-zinc-600">{normalizeUnit(it.unit)}</p>
                <p className="text-right tabular-nums text-zinc-700">
                  {formatCurrency(it.unitPrice)}
                </p>
                <p className="text-right font-medium tabular-nums text-zinc-900">
                  {formatCurrency(it.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-right text-base font-semibold tabular-nums text-zinc-900">
        税抜合計：{formatCurrency(subtotal)}
      </p>
    </div>
  );
}
