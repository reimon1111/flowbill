"use client";

import { cn } from "@/lib/utils";
import type { YearFilterOption, YearFilterValue } from "@/lib/list-query";

export function YearFilter({
  value,
  options,
  onChange,
  className,
}: {
  value: YearFilterValue;
  options: YearFilterOption[];
  onChange: (value: YearFilterValue) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <span className="shrink-0 text-xs font-medium text-zinc-500">年</span>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
            value === option.value
              ? "bg-zinc-900 text-white"
              : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
