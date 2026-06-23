/** ISO日付文字列 (YYYY-MM-DD) をパース（タイムゾーン非依存） */
function parseDateOnly(isoDate: string): {
  year: number;
  month: number;
  day: number;
} {
  const datePart = isoDate.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  return { year, month, day };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** サーバー/クライアントで同じ結果になる日付表示 */
export function formatDate(date: string): string {
  const { year, month, day } = parseDateOnly(date);
  return `${year}年${month}月${day}日`;
}

export function formatShortDate(date: string): string {
  const { month, day } = parseDateOnly(date);
  return `${month}/${day}`;
}

export function formatDateTime(iso: string): string {
  return formatDate(iso);
}

export function formatTaxRate(rate: number): string {
  if (rate === 0) return "非課税";
  return `${rate}%`;
}

const WEEKDAY_LABELS = [
  "日曜日",
  "月曜日",
  "火曜日",
  "水曜日",
  "木曜日",
  "金曜日",
  "土曜日",
] as const;

export function formatTodayLocal(date: Date): string {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const weekday = WEEKDAY_LABELS[date.getDay()];
  return `${y}年${m}月${d}日${weekday}`;
}
