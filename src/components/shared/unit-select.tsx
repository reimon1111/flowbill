"use client";

import { DEFAULT_UNIT, normalizeUnit, UNIT_OPTIONS } from "@/lib/constants/units";
import { cn } from "@/lib/utils";

const selectClass =
  "flex w-full rounded-lg border border-zinc-200/80 bg-white px-2 text-sm text-zinc-900 outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200";

export function UnitSelect({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (unit: string) => void;
  compact?: boolean;
}) {
  const normalized = normalizeUnit(value);
  const isPreset = UNIT_OPTIONS.includes(
    normalized as (typeof UNIT_OPTIONS)[number]
  );

  return (
    <select
      value={isPreset ? normalized : DEFAULT_UNIT}
      onChange={(e) => {
        onChange(e.target.value);
      }}
      className={cn(selectClass, compact ? "h-9" : "h-11 rounded-xl px-3 text-base")}
    >
      {!isPreset && normalized !== DEFAULT_UNIT ? (
        <option value={normalized}>{normalized}</option>
      ) : null}
      {UNIT_OPTIONS.map((u) => (
        <option key={u} value={u}>
          {u}
        </option>
      ))}
    </select>
  );
}
