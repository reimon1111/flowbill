"use client";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CUSTOMER_HONORIFIC_OPTIONS,
  type CustomerHonorific,
} from "@/lib/customer-honorific";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

type CustomerHonorificSelectProps = {
  value: CustomerHonorific;
  onChange: (value: CustomerHonorific) => void;
  disabled?: boolean;
  className?: string;
  error?: unknown;
};

const selectClass =
  "flex h-11 w-full min-w-0 rounded-xl border border-zinc-200/80 bg-white px-3 text-base text-zinc-900 outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200 disabled:opacity-60";

export function CustomerHonorificSelect({
  value,
  onChange,
  disabled,
  className,
  error,
}: CustomerHonorificSelectProps) {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <Label className="text-sm font-medium text-zinc-700">顧客敬称</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as CustomerHonorific)}
        className={selectClass}
        aria-invalid={Boolean(error)}
      >
        {CUSTOMER_HONORIFIC_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
      ) : null}
    </div>
  );
}
