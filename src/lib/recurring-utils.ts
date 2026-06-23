/** 請求日（1〜28）を月内に収める */
export function clampBillingDay(day: number): number {
  return Math.min(28, Math.max(1, Math.round(day)));
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 初回の次回請求日（今日以降で最も近い請求日） */
export function computeInitialNextBillingDate(
  billingDay: number,
  fromDate = new Date()
): string {
  const day = clampBillingDay(billingDay);
  const base = startOfDay(fromDate);
  let candidate = new Date(base.getFullYear(), base.getMonth(), day);
  if (candidate < base) {
    candidate = new Date(base.getFullYear(), base.getMonth() + 1, day);
  }
  return toISODate(candidate);
}

/** 請求書生成後に次回請求日を1ヶ月進める */
export function advanceNextBillingDate(
  currentNext: string,
  billingDay: number
): string {
  const day = clampBillingDay(billingDay);
  const d = new Date(currentNext + "T00:00:00");
  const next = new Date(d.getFullYear(), d.getMonth() + 1, day);
  return toISODate(next);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function daysUntil(iso: string): number {
  const today = startOfDay(new Date());
  const target = startOfDay(new Date(iso + "T00:00:00"));
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export function formatNextBillingLabel(nextBillingDate: string): string {
  const d = daysUntil(nextBillingDate);
  if (d === 0) return "今日";
  if (d > 0) return `あと${d}日`;
  return `${Math.abs(d)}日超過`;
}

export const RECURRING_PROJECT_PREFIX = "定期請求：";
