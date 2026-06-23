"use client";

import { UnitSelect } from "@/components/shared/unit-select";
import { DEFAULT_UNIT } from "@/lib/constants/units";

export function UnitField({
  value,
  onChange,
}: {
  value: string;
  onChange: (unit: string) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-zinc-500">単位</p>
      <UnitSelect value={value || DEFAULT_UNIT} onChange={onChange} />
    </div>
  );
}
