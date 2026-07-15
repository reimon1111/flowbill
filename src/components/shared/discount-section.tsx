"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DocumentDiscountFields } from "@/lib/discount-totals";

type DiscountSectionProps = {
  value: DocumentDiscountFields;
  onChange: (value: DocumentDiscountFields) => void;
  disabled?: boolean;
  className?: string;
  amountError?: string;
  labelError?: string;
};

export function DiscountSection({
  value,
  onChange,
  disabled,
  className,
  amountError,
  labelError,
}: DiscountSectionProps) {
  const [open, setOpen] = useState(
    value.discountAmount > 0 || value.discountLabel.trim().length > 0
  );

  if (!open) {
    return (
      <div className={className}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="h-9 rounded-xl border-zinc-200 text-zinc-700"
        >
          値引きを追加
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-zinc-700">値引き</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => {
            onChange({ discountLabel: "", discountAmount: 0 });
            setOpen(false);
          }}
          className="h-8 rounded-lg text-xs text-zinc-500 hover:text-zinc-800"
        >
          値引きを削除
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">値引き名</label>
          <Input
            value={value.discountLabel}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...value, discountLabel: e.target.value })
            }
            placeholder="例: 特別値引き"
            className="h-11 w-full min-w-0 rounded-xl border-zinc-200/80"
          />
          {labelError ? (
            <p className="text-sm text-red-600">{labelError}</p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">値引き額</label>
          <Input
            type="number"
            min={0}
            step={1}
            value={value.discountAmount || ""}
            disabled={disabled}
            onChange={(e) => {
              const next = e.target.value === "" ? 0 : Number(e.target.value);
              onChange({
                ...value,
                discountAmount: Number.isFinite(next) ? Math.max(0, next) : 0,
              });
            }}
            placeholder="0"
            className="h-11 w-full min-w-0 rounded-xl border-zinc-200/80"
          />
          {amountError ? (
            <p className="text-sm text-red-600">{amountError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
