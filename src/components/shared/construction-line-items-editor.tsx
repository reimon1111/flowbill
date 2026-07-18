"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const cellInputClass =
  "h-9 rounded-lg border-zinc-200/80 px-2 text-sm shadow-none focus-visible:ring-zinc-300";

const fieldLabelClass = "text-[11px] font-medium text-zinc-400";

/**
 * 商品名入力。
 * はみ出し有無で DOM 構造を切り替えない（再マウントでフォーカス喪失を防ぐ）。
 */
function LineItemNameInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [truncated, setTruncated] = useState(false);
  const [isComposing, setIsComposing] = useState(false);

  const measure = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    setTruncated(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [value, measure]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure]);

  const tooltipEnabled = truncated && value.trim().length > 0;

  return (
    <Tooltip>
      <TooltipTrigger
        delay={400}
        closeDelay={0}
        disabled={!tooltipEnabled}
        render={<div className="min-w-0 w-full outline-none" />}
      >
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => {
            setIsComposing(false);
            measure();
          }}
          onFocus={measure}
          onBlur={measure}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || isComposing) return;
          }}
          placeholder={placeholder}
          className={cn(cellInputClass, "w-full min-w-0 font-medium")}
        />
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="start"
        className="max-w-[min(90vw,28rem)] whitespace-pre-wrap break-words text-left"
      >
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 2段レイアウトの商品明細エディタ（案件・見積・注文・納品・請求・領収で共通）。
 *
 * 1段目: 商品名（横幅いっぱい）
 * 2段目: W / H / 数量 / 単位 / 単価 / 金額
 */
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
    <TooltipProvider delay={400}>
      <div className="overflow-x-hidden rounded-xl border border-zinc-200/80 bg-white">
        {items.map((it, idx) => {
          const amount = it.quantity * it.unitPrice;
          return (
            <div
              key={`line-item-${idx}`}
              className="space-y-3 border-b border-zinc-100 p-3 last:border-b-0 sm:p-4"
            >
              {/* 1段目: 商品名（全幅） */}
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className={cn(fieldLabelClass, "mb-1")}>商品名／品目</p>
                  <LineItemNameInput
                    value={it.name}
                    onChange={(name) => updateField(idx, { name })}
                    placeholder={namePlaceholder}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(idx)}
                  className="mt-5 flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                  aria-label="明細を削除"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>

              {/* 2段目: 数値系（PCは横並び、スマホは折り返し） */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end lg:gap-3">
                <div className="min-w-0 space-y-1 lg:w-[72px]">
                  <p className={fieldLabelClass}>W</p>
                  <Input
                    value={it.width}
                    onChange={(e) =>
                      updateField(idx, { width: e.target.value })
                    }
                    placeholder="900"
                    className={cn(cellInputClass, "w-full tabular-nums")}
                  />
                </div>
                <div className="min-w-0 space-y-1 lg:w-[72px]">
                  <p className={fieldLabelClass}>H</p>
                  <Input
                    value={it.height}
                    onChange={(e) =>
                      updateField(idx, { height: e.target.value })
                    }
                    placeholder="1800"
                    className={cn(cellInputClass, "w-full tabular-nums")}
                  />
                </div>
                <div className="min-w-0 space-y-1 lg:w-[72px]">
                  <p className={fieldLabelClass}>数量</p>
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
                    className={cn(
                      cellInputClass,
                      "w-full text-right tabular-nums"
                    )}
                  />
                </div>
                <div className="min-w-0 space-y-1 lg:w-[88px]">
                  <p className={fieldLabelClass}>単位</p>
                  <UnitSelect
                    value={it.unit}
                    onChange={(unit) => updateUnit(idx, unit)}
                    compact
                  />
                </div>
                <div className="min-w-0 space-y-1 lg:w-[104px]">
                  <p className={fieldLabelClass}>単価</p>
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
                    className={cn(
                      cellInputClass,
                      "w-full text-right tabular-nums"
                    )}
                  />
                </div>
                <div className="flex min-w-0 items-end justify-between gap-2 pb-1 sm:col-span-1 lg:ml-auto lg:w-[120px] lg:justify-end lg:pb-0">
                  <p className={cn(fieldLabelClass, "lg:sr-only")}>金額</p>
                  <div className="text-right">
                    <p className={cn(fieldLabelClass, "mb-1 hidden lg:block")}>
                      金額
                    </p>
                    <p className="flex h-9 items-center justify-end font-medium tabular-nums text-zinc-900">
                      {formatCurrency(amount)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
