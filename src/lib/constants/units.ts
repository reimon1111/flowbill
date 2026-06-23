export const UNIT_OPTIONS = [
  "一式",
  "本",
  "m",
  "m2",
  "㎡",
  "ケ",
  "式",
  "枚",
  "連",
  "台",
  "セット",
  "ヶ月",
] as const;

export const DEFAULT_UNIT = "一式";

export function normalizeUnit(unit?: string | null): string {
  const trimmed = unit?.trim();
  return trimmed ? trimmed : DEFAULT_UNIT;
}
