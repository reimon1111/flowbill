"use client";

import { cn } from "@/lib/utils";

export type SortSelectOption<T extends string> = {
  value: T;
  label: string;
};

export function SortSelect<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: SortSelectOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <label className={cn("flex min-w-0 items-center gap-2", className)}>
      <span className="shrink-0 text-xs font-medium text-zinc-500">並び替え</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 min-w-0 max-w-full flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-sm text-zinc-800 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
