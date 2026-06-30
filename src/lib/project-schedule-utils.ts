import type { ProjectStatus } from "@/lib/types";

export const SCHEDULE_DAY_WIDTH = 32;
export const SCHEDULE_ROW_HEIGHT = 104;
export const SCHEDULE_HEADER_HEIGHT = 56;

export type ScheduleRangeMonths = 1 | 2 | 3;

export const SCHEDULE_STATUS_BAR_STYLES: Record<
  ProjectStatus,
  { bar: string; text: string }
> = {
  estimate: {
    bar: "bg-sky-100 ring-1 ring-sky-200/80",
    text: "text-sky-800",
  },
  ordered: {
    bar: "bg-violet-100 ring-1 ring-violet-200/80",
    text: "text-violet-800",
  },
  in_progress: {
    bar: "bg-amber-100 ring-1 ring-amber-200/80",
    text: "text-amber-900",
  },
  completed: {
    bar: "bg-emerald-100 ring-1 ring-emerald-200/80",
    text: "text-emerald-800",
  },
  lost: {
    bar: "bg-zinc-100 ring-1 ring-zinc-200/80",
    text: "text-zinc-600",
  },
};

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysBetweenInclusive(start: Date, end: Date): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24)) + 1;
}

export function daysBetween(start: Date, end: Date): number {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function buildDateRange(start: Date, dayCount: number): Date[] {
  return Array.from({ length: dayCount }, (_, i) => addDays(start, i));
}

export function getMonthDayCount(months: ScheduleRangeMonths): number {
  if (months === 1) return 31;
  if (months === 2) return 62;
  return 92;
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getBarPosition(
  viewStart: Date,
  viewDayCount: number,
  projectStartIso: string,
  projectEndIso: string,
  dayWidth: number
): { left: number; width: number } | null {
  const projectStart = parseIsoDate(projectStartIso);
  const projectEnd = parseIsoDate(projectEndIso);
  const viewEnd = addDays(viewStart, viewDayCount - 1);

  if (projectEnd < viewStart || projectStart > viewEnd) return null;

  const visibleStart = projectStart > viewStart ? projectStart : viewStart;
  const visibleEnd = projectEnd < viewEnd ? projectEnd : viewEnd;

  const left = daysBetween(viewStart, visibleStart) * dayWidth;
  const width = daysBetweenInclusive(visibleStart, visibleEnd) * dayWidth - 4;

  return { left, width: Math.max(width, dayWidth - 4) };
}

export function projectHasSchedule(
  startDate: string,
  endDate: string
): boolean {
  return Boolean(startDate && endDate);
}

export function overlapsCurrentWeek(
  startDate: string,
  endDate: string,
  today: Date
): boolean {
  if (!projectHasSchedule(startDate, endDate)) return false;
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const weekStart = addDays(startOfDay(today), mondayOffset);
  const weekEnd = addDays(weekStart, 6);
  return start <= weekEnd && end >= weekStart;
}

export function getWeeklyScheduleProjects(
  projects: Array<{
    id: string;
    projectName: string;
    customerName: string;
    startDate: string;
    endDate: string;
    status: ProjectStatus;
    archived: boolean;
  }>,
  today = startOfDay(new Date())
) {
  return projects
    .filter((p) => !p.archived)
    .filter((p) => overlapsCurrentWeek(p.startDate, p.endDate, today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function overlapsRange(
  startDate: string,
  endDate: string,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  return start <= rangeEnd && end >= rangeStart;
}
