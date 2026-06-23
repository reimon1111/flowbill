import { addDaysToDate } from "@/lib/quote-dates";

export const QUOTE_EXPIRY_TYPES = [
  "1_week",
  "2_weeks",
  "3_weeks",
  "1_month",
  "2_months",
  "3_months",
  "custom",
] as const;

export type QuoteExpiryType = (typeof QUOTE_EXPIRY_TYPES)[number];

export const QUOTE_EXPIRY_PERIOD_TYPES = [
  "1_week",
  "2_weeks",
  "3_weeks",
  "1_month",
  "2_months",
  "3_months",
] as const;

export type QuoteExpiryPeriodType = (typeof QUOTE_EXPIRY_PERIOD_TYPES)[number];

export const DEFAULT_QUOTE_EXPIRY_TYPE: QuoteExpiryPeriodType = "1_month";

export const QUOTE_EXPIRY_TYPE_LABELS: Record<QuoteExpiryType, string> = {
  "1_week": "1週間",
  "2_weeks": "2週間",
  "3_weeks": "3週間",
  "1_month": "1ヶ月",
  "2_months": "2ヶ月",
  "3_months": "3ヶ月",
  custom: "任意の日付",
};

export const QUOTE_EXPIRY_PERIOD_OPTIONS = QUOTE_EXPIRY_PERIOD_TYPES.map(
  (value) => ({
    value,
    label: QUOTE_EXPIRY_TYPE_LABELS[value],
  })
);

export const QUOTE_EXPIRY_FORM_OPTIONS = [
  ...QUOTE_EXPIRY_PERIOD_OPTIONS,
  { value: "custom" as const, label: QUOTE_EXPIRY_TYPE_LABELS.custom },
];

export function isQuoteExpiryType(value: string): value is QuoteExpiryType {
  return (QUOTE_EXPIRY_TYPES as readonly string[]).includes(value);
}

export function parseQuoteExpiryType(
  value: string | null | undefined,
  fallback: QuoteExpiryType = "custom"
): QuoteExpiryType {
  if (value && isQuoteExpiryType(value)) return value;
  return fallback;
}

export function expiryTypeToLegacyDays(type: QuoteExpiryPeriodType): number {
  switch (type) {
    case "1_week":
      return 7;
    case "2_weeks":
      return 14;
    case "3_weeks":
      return 21;
    case "1_month":
      return 30;
    case "2_months":
      return 60;
    case "3_months":
      return 90;
    default:
      return 30;
  }
}

export function legacyDaysToExpiryType(days: number): QuoteExpiryPeriodType {
  if (days <= 7) return "1_week";
  if (days <= 14) return "2_weeks";
  if (days <= 21) return "3_weeks";
  if (days <= 30) return "1_month";
  if (days <= 60) return "2_months";
  return "3_months";
}

function addMonthsToDate(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1 + months, d);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${day}`;
}

/** 発行日と期間タイプから有効期限日を計算 */
export function calculateQuoteExpiryDate(
  issueDate: string,
  expiryType: QuoteExpiryType,
  customExpiryDate?: string
): string {
  if (!issueDate) return customExpiryDate ?? "";

  if (expiryType === "custom") {
    return customExpiryDate ?? issueDate;
  }

  switch (expiryType) {
    case "1_week":
      return addDaysToDate(issueDate, 7);
    case "2_weeks":
      return addDaysToDate(issueDate, 14);
    case "3_weeks":
      return addDaysToDate(issueDate, 21);
    case "1_month":
      return addMonthsToDate(issueDate, 1);
    case "2_months":
      return addMonthsToDate(issueDate, 2);
    case "3_months":
      return addMonthsToDate(issueDate, 3);
    default:
      return customExpiryDate ?? issueDate;
  }
}

export function resolveQuoteExpiryDate(
  issueDate: string,
  expiryType: QuoteExpiryType,
  expiryDate: string
): string {
  if (expiryType === "custom") {
    return expiryDate;
  }
  return calculateQuoteExpiryDate(issueDate, expiryType);
}

export type QuoteExpiryDisplayStatus = "expired" | "soon" | "ok";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function getDaysUntilQuoteExpiry(expiryDate: string): number {
  if (!expiryDate) return 0;
  const today = startOfDay(new Date());
  const due = startOfDay(new Date(expiryDate + "T00:00:00"));
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export function getQuoteExpiryDisplayStatus(
  expiryDate: string
): QuoteExpiryDisplayStatus {
  const days = getDaysUntilQuoteExpiry(expiryDate);
  if (days < 0) return "expired";
  if (days <= 7) return "soon";
  return "ok";
}

export function formatQuoteExpiryListText(expiryDate: string): string {
  const status = getQuoteExpiryDisplayStatus(expiryDate);
  const days = getDaysUntilQuoteExpiry(expiryDate);
  if (status === "expired") {
    return days === -1 ? "昨日まで" : `${Math.abs(days)}日超過`;
  }
  if (days === 0) return "今日まで";
  if (status === "soon") return `あと${days}日`;
  return `あと${days}日`;
}
