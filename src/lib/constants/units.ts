export const UNIT_OPTIONS = [
  "式",
  "本",
  "m",
  "m2",
  "㎡",
  "ケ",
  "枚",
  "連",
  "台",
  "セット",
  "ヶ月",
] as const;

export const DEFAULT_UNIT = "式";

/** 旧表記「一式」は「式」に正規化する */
export function normalizeUnit(unit?: string | null): string {
  const trimmed = unit?.trim();
  if (!trimmed) return DEFAULT_UNIT;
  if (trimmed === "一式") return DEFAULT_UNIT;
  return trimmed;
}
