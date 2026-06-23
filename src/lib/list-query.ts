/** 一覧のフィルター・ソート・ページング（将来 Supabase limit/offset へ移行しやすい形） */

export const LIST_PAGE_SIZE = 15;

export type YearFilterValue = "current" | "all" | number;

export type YearFilterOption = {
  value: YearFilterValue;
  label: string;
};

export type PaginatedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export function extractYearFromDate(value: string | null | undefined): number | null {
  if (!value?.trim()) return null;
  const datePart = value.trim().slice(0, 10);
  const year = Number(datePart.slice(0, 4));
  return Number.isFinite(year) && year > 1900 ? year : null;
}

export function getCurrentYear(): number {
  return new Date().getFullYear();
}

export function matchesYearFilter(
  dateStr: string | null | undefined,
  yearFilter: YearFilterValue,
  fallbackIso?: string
): boolean {
  if (yearFilter === "all") return true;
  const targetYear =
    yearFilter === "current" ? getCurrentYear() : yearFilter;
  const year =
    extractYearFromDate(dateStr) ?? extractYearFromDate(fallbackIso);
  return year === targetYear;
}

export function collectYearsFromDates(
  dates: Array<string | null | undefined>
): number[] {
  const years = new Set<number>();
  for (const d of dates) {
    const y = extractYearFromDate(d);
    if (y) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

/** 今年 → データ内の年（降順）→ すべて */
export function buildYearFilterOptions(dataYears: number[]): YearFilterOption[] {
  const currentYear = getCurrentYear();
  const years = new Set(dataYears);
  years.add(currentYear);

  const options: YearFilterOption[] = [{ value: "current", label: "今年" }];

  for (const year of Array.from(years).sort((a, b) => b - a)) {
    if (year === currentYear) continue;
    options.push({ value: year, label: `${year}年` });
  }

  options.push({ value: "all", label: "すべて" });
  return options;
}

export function paginateList<T>(
  items: T[],
  page: number,
  pageSize = LIST_PAGE_SIZE
): PaginatedResult<T> {
  const totalCount = items.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
  };
}

export function compareDateDesc(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return b.localeCompare(a);
}

export function compareDateAsc(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b);
}

export function compareNumberDesc(a: number, b: number): number {
  return b - a;
}

export function compareNumberAsc(a: number, b: number): number {
  return a - b;
}
