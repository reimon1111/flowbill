"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchBarProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function SearchBar({
  value,
  onChange,
  placeholder = "検索...",
  className,
}: SearchBarProps) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
        strokeWidth={1.5}
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border-zinc-200/80 bg-white pl-10 pr-10 text-base shadow-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
          aria-label="検索をクリア"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
