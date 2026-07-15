"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  customerFormDefaults,
  customerFormSchema,
  type CustomerFormValues,
} from "@/lib/validations/customer";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import { CUSTOMER_SAVE_FAILED_MESSAGE } from "@/lib/db/errors";
import { toast } from "sonner";

type CustomerFormProps = {
  defaultValues?: Partial<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
  submitLabel?: string;
};

export function CustomerForm({
  defaultValues,
  onSubmit,
  submitLabel = "保存する",
}: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { ...customerFormDefaults, ...defaultValues },
  });

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        try {
          await onSubmit(values);
        } catch (error) {
          const message =
            error instanceof Error ? error.message : CUSTOMER_SAVE_FAILED_MESSAGE;
          toast.error(message);
        }
      })}
      className="space-y-6"
    >
      <FormSection
        title="基本情報"
        description="会社名は必須です。案件作成時に自動入力されます。"
      >
        <Field label="会社名" required error={errors.customerName?.message}>
          <Input
            {...register("customerName")}
            placeholder="株式会社サンプル"
            className={inputClass}
          />
        </Field>
        <Field label="担当者名" error={errors.contactName?.message}>
          <Input
            {...register("contactName")}
            placeholder="佐藤 太郎"
            className={inputClass}
          />
        </Field>
      </FormSection>

      <FormSection title="連絡先">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="メール" error={errors.email?.message}>
            <Input
              {...register("email")}
              type="email"
              placeholder="info@example.co.jp"
              className={inputClass}
            />
          </Field>
          <Field label="電話番号" error={errors.phone?.message}>
            <Input
              {...register("phone")}
              placeholder="03-1234-5678"
              className={inputClass}
            />
          </Field>
          <Field label="FAX" error={errors.fax?.message}>
            <Input
              {...register("fax")}
              placeholder="03-1234-5679"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-[140px_1fr]">
          <Field label="郵便番号" error={errors.postalCode?.message}>
            <Input
              {...register("postalCode")}
              placeholder="150-0001"
              className={inputClass}
            />
          </Field>
          <Field label="住所" error={errors.address?.message}>
            <Input
              {...register("address")}
              placeholder="東京都渋谷区..."
              className={inputClass}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title="請求情報"
        description="請求書に記載する請求先名です。空欄の場合は会社名が使われます。"
      >
        <Field
          label="請求先名"
          error={errors.invoiceDestination?.message}
        >
          <Input
            {...register("invoiceDestination")}
            placeholder="株式会社サンプル 経理部"
            className={inputClass}
          />
        </Field>
      </FormSection>

      <FormSection title="メモ">
        <Field label="メモ" error={errors.memo?.message}>
          <Textarea
            {...register("memo")}
            placeholder="支払条件や注意事項など"
            rows={4}
            className="min-h-[120px] resize-none rounded-xl border-zinc-200/80 text-base"
          />
        </Field>
      </FormSection>

      <div className="sticky bottom-0 -mx-4 border-t border-zinc-200/80 bg-zinc-50/80 px-4 py-4 backdrop-blur-sm sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="mx-auto flex max-w-3xl justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-11 min-w-[140px] rounded-xl bg-zinc-900 hover:bg-zinc-800"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                保存中...
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}

const inputClass =
  "h-11 rounded-xl border-zinc-200/80 text-base shadow-none focus-visible:ring-zinc-300";

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {error != null && error !== "" && (
        <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
      )}
    </div>
  );
}
