"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

type DocumentEmailFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: unknown;
  name?: string;
};

export function DocumentEmailField({
  value,
  onChange,
  onBlur,
  disabled,
  error,
  name = "documentEmail",
}: DocumentEmailFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-sm font-medium text-zinc-700">
        メールアドレス
      </Label>
      <Input
        id={name}
        name={name}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        placeholder="例: info@example.com"
        className="h-11 rounded-xl border-zinc-200/80 text-base shadow-none focus-visible:ring-zinc-300"
      />
      {error ? (
        <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
      ) : null}
    </div>
  );
}
