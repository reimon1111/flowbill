"use client";

import { Star } from "lucide-react";
import type { ItemTemplateCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryFilterProps = {
  categories: string[];
  selectedCategory: ItemTemplateCategory | "all";
  onCategoryChange: (category: ItemTemplateCategory | "all") => void;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
};

export function CategoryFilter({
  categories,
  selectedCategory,
  onCategoryChange,
  favoritesOnly,
  onFavoritesOnlyChange,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="flex flex-wrap gap-2">
        <FilterChip
          active={selectedCategory === "all"}
          onClick={() => onCategoryChange("all")}
        >
          すべて
        </FilterChip>
        {categories.map((cat) => (
          <FilterChip
            key={cat}
            active={selectedCategory === cat}
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
          </FilterChip>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
          favoritesOnly
            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
            : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
        )}
      >
        <Star
          className={cn(
            "size-4",
            favoritesOnly ? "fill-amber-400 text-amber-400" : "text-zinc-400"
          )}
        />
        お気に入りのみ
      </button>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
      )}
    >
      {children}
    </button>
  );
}
