"use client";

import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  formatTitleAmount,
  normalizeProjectTitle,
  parseProjectTitle,
} from "@/lib/project-title";
import { formatCurrency } from "@/lib/format";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

const PLACEHOLDER = `HP制作 10000円
チラシ制作 10000円
動画制作 200000円
合計220000円`;

type ProjectTitleFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  amount: number;
  onAmountChange: (amount: number) => void;
  error?: unknown;
};

export function ProjectTitleField({
  value,
  onChange,
  onBlur,
  amount,
  onAmountChange,
  error,
}: ProjectTitleFieldProps) {
  const parsed = useMemo(() => parseProjectTitle(value), [value]);
  const autoAmount = parsed.lines.some((l) => l.amount > 0);

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-zinc-700">
        題名
        <span className="ml-1 text-red-500">*</span>
      </Label>
      <Textarea
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          onChange(next);
          const p = parseProjectTitle(next);
          if (p.lines.some((l) => l.amount > 0)) {
            onAmountChange(p.total);
          }
        }}
        onBlur={() => {
          const normalized = normalizeProjectTitle(value);
          if (normalized !== value) {
            onChange(normalized);
            const p = parseProjectTitle(normalized);
            if (p.lines.some((l) => l.amount > 0)) {
              onAmountChange(p.total);
            }
          }
          onBlur?.();
        }}
        placeholder={PLACEHOLDER}
        rows={6}
        className="min-h-[160px] resize-y rounded-xl border-zinc-200/80 text-base leading-relaxed"
      />
      <p className="text-xs text-zinc-500">
        1行に「項目名」と「金額（円）」を入力。複数行で合計が自動計算されます。フォーカスを外すと「合計」行を整えます。
      </p>
      {autoAmount && (
        <p className="text-sm text-zinc-700">
          税抜合計（自動）:{" "}
          <span className="font-semibold tabular-nums text-zinc-900">
            {formatCurrency(parsed.total)}
          </span>
          {amount !== parsed.total && (
            <span className="ml-2 text-xs text-amber-700">
              ※保存時は {formatTitleAmount(parsed.total)} に同期されます
            </span>
          )}
        </p>
      )}
      {error ? (
        <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
      ) : null}
    </div>
  );
}
