"use client";

import { cn } from "@/lib/utils";
import { LIST_PAGE_SIZE } from "@/lib/list-query";

export function ListPagination({
  page,
  totalPages,
  totalCount,
  pageSize = LIST_PAGE_SIZE,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalCount === 0) return null;

  const showing = Math.min(pageSize, totalCount - (page - 1) * pageSize);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-between gap-3 border-t border-zinc-100 pt-4 sm:flex-row",
        className
      )}
    >
      <p className="text-sm text-zinc-500">
        <span className="font-medium text-zinc-700">
          {page} / {totalPages}ページ
        </span>
        <span className="mx-2 text-zinc-300">·</span>
        <span>{showing}件表示中</span>
        <span className="text-zinc-400">（全{totalCount}件）</span>
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            page <= 1
              ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
              : "bg-white text-zinc-700 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
          )}
        >
          前へ
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
            page >= totalPages
              ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
              : "bg-white text-zinc-700 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
          )}
        >
          次へ
        </button>
      </div>
    </div>
  );
}
