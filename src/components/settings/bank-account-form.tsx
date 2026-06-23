"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BankAccountForm({
  values,
  onChange,
}: {
  values: {
    bankName: string;
    bankBranch: string;
    bankAccountType: string;
    bankAccountNumber: string;
    bankAccountHolder: string;
  };
  onChange: (patch: Partial<typeof values>) => void;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field label="銀行名">
        <Input
          value={values.bankName}
          onChange={(e) => onChange({ bankName: e.target.value })}
          className="h-11 rounded-xl text-base"
        />
      </Field>
      <Field label="支店名">
        <Input
          value={values.bankBranch}
          onChange={(e) => onChange({ bankBranch: e.target.value })}
          className="h-11 rounded-xl text-base"
        />
      </Field>
      <Field label="口座種別">
        <Input
          value={values.bankAccountType}
          onChange={(e) => onChange({ bankAccountType: e.target.value })}
          className="h-11 rounded-xl text-base"
        />
      </Field>
      <Field label="口座番号">
        <Input
          value={values.bankAccountNumber}
          onChange={(e) => onChange({ bankAccountNumber: e.target.value })}
          className="h-11 rounded-xl text-base"
        />
      </Field>
      <Field label="口座名義" className="sm:col-span-2">
        <Input
          value={values.bankAccountHolder}
          onChange={(e) => onChange({ bankAccountHolder: e.target.value })}
          className="h-11 rounded-xl text-base"
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-2 block text-sm font-medium text-zinc-700">
        {label}
      </Label>
      {children}
    </div>
  );
}

