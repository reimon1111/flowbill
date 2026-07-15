"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CounterpartyContactFields } from "@/lib/counterparty-contact";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

type CounterpartyContactFieldsEditorProps = {
  value: CounterpartyContactFields;
  onChange: (value: CounterpartyContactFields) => void;
  disabled?: boolean;
  className?: string;
  errors?: Partial<Record<keyof CounterpartyContactFields, unknown>>;
};

const inputClass =
  "h-11 w-full min-w-0 rounded-xl border-zinc-200/80 text-base shadow-none focus-visible:ring-zinc-300";

export function CounterpartyContactFieldsEditor({
  value,
  onChange,
  disabled,
  className,
  errors,
}: CounterpartyContactFieldsEditorProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", className)}>
      <div className="min-w-0 space-y-2 sm:col-span-2">
        <Label className="text-sm font-medium text-zinc-700">担当者名</Label>
        <Input
          value={value.customerContactName}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, customerContactName: e.target.value })
          }
          placeholder="例: 山田 太郎"
          className={inputClass}
        />
        {errors?.customerContactName ? (
          <p className="text-sm text-red-600">
            {formatFieldErrorMessage(errors.customerContactName)}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <Label className="text-sm font-medium text-zinc-700">部署名</Label>
        <Input
          value={value.customerDepartment}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, customerDepartment: e.target.value })
          }
          placeholder="例: 営業部"
          className={inputClass}
        />
        {errors?.customerDepartment ? (
          <p className="text-sm text-red-600">
            {formatFieldErrorMessage(errors.customerDepartment)}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 space-y-2">
        <Label className="text-sm font-medium text-zinc-700">役職</Label>
        <Input
          value={value.customerPosition}
          disabled={disabled}
          onChange={(e) =>
            onChange({ ...value, customerPosition: e.target.value })
          }
          placeholder="例: 課長"
          className={inputClass}
        />
        {errors?.customerPosition ? (
          <p className="text-sm text-red-600">
            {formatFieldErrorMessage(errors.customerPosition)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
