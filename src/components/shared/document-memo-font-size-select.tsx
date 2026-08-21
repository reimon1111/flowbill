"use client";

import { Label } from "@/components/ui/label";
import {
  DOCUMENT_MEMO_FONT_SIZE_OPTIONS,
  type DocumentMemoFontSize,
} from "@/lib/document-memo-font-size";
import { cn } from "@/lib/utils";

export function DocumentMemoFontSizeSelect({
  value,
  onChange,
  disabled = false,
  id = "memo-font-size",
}: {
  value: DocumentMemoFontSize;
  onChange: (next: DocumentMemoFontSize) => void;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <div className="space-y-2 sm:max-w-xs">
      <Label htmlFor={id} className="text-sm font-medium text-zinc-700">
        文字サイズ
      </Label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as DocumentMemoFontSize)}
        className={cn(
          "h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-800 shadow-sm",
          "focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80",
          disabled && "cursor-not-allowed opacity-60"
        )}
      >
        {DOCUMENT_MEMO_FONT_SIZE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
