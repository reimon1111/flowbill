"use client";

import { SearchBar } from "@/components/shared/search-bar";
import { YearFilter } from "@/components/common/year-filter";
import { SortSelect, type SortSelectOption } from "@/components/common/sort-select";
import { cn } from "@/lib/utils";
import type { YearFilterOption, YearFilterValue } from "@/lib/list-query";

export function ListToolbar<TSort extends string>({
  search,
  onSearchChange,
  searchPlaceholder,
  yearFilter,
  yearOptions,
  onYearFilterChange,
  sort,
  sortOptions,
  onSortChange,
  showYearFilter = true,
  statusFilters,
  extraFilters,
  className,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  yearFilter: YearFilterValue;
  yearOptions: YearFilterOption[];
  onYearFilterChange: (value: YearFilterValue) => void;
  sort: TSort;
  sortOptions: SortSelectOption<TSort>[];
  onSortChange: (value: TSort) => void;
  showYearFilter?: boolean;
  statusFilters?: React.ReactNode;
  extraFilters?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:gap-4">
        <SearchBar
          value={search}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          className="min-w-0 flex-1 xl:max-w-sm"
        />
        <YearFilter
          value={yearFilter}
          options={yearOptions}
          onChange={onYearFilterChange}
          className={cn(showYearFilter ? "xl:flex-1" : "hidden")}
        />
        <SortSelect
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
          className="w-full xl:w-auto xl:min-w-[220px]"
        />
      </div>

      {(statusFilters || extraFilters) && (
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          {statusFilters ? (
            <div className="flex flex-wrap items-center gap-2">{statusFilters}</div>
          ) : null}
          {extraFilters ? (
            <div className="flex flex-wrap items-center gap-2">{extraFilters}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function ListFilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-zinc-900 text-white"
          : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50",
        className
      )}
    >
      {children}
    </button>
  );
}
