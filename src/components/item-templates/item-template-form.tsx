"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Star } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ITEM_TEMPLATE_CATEGORIES } from "@/lib/types";
import { CategorySelect } from "@/components/item-templates/category-select";
import {
  itemTemplateFormDefaults,
  itemTemplateFormSchema,
  type ItemTemplateFormValues,
} from "@/lib/validations/item-template";
import { cn } from "@/lib/utils";
import { formatFieldErrorMessage } from "@/lib/form-error-message";

const TAX_OPTIONS = [
  { value: 10, label: "10%（標準税率）" },
  { value: 8, label: "8%（軽減税率）" },
  { value: 0, label: "非課税（0%）" },
] as const;

type ItemTemplateFormProps = {
  defaultValues?: Partial<ItemTemplateFormValues>;
  onSubmit: (values: ItemTemplateFormValues) => Promise<void>;
  submitLabel?: string;
};

export function ItemTemplateForm({
  defaultValues,
  onSubmit,
  submitLabel = "保存する",
}: ItemTemplateFormProps) {
  void ITEM_TEMPLATE_CATEGORIES;

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ItemTemplateFormValues>({
    resolver: zodResolver(itemTemplateFormSchema),
    defaultValues: { ...itemTemplateFormDefaults, ...defaultValues },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <FormSection
        title="項目の基本"
        description="見積作成時にワンクリックで呼び出せる項目名と単価を登録します"
      >
        <div className="grid gap-5 lg:grid-cols-[1fr_200px]">
          <Field label="項目名" required error={errors.name?.message}>
            <Input
              {...register("name")}
              placeholder="HP制作"
              className={cn(inputClass, "text-lg font-medium")}
            />
          </Field>
          <Field label="単価（税抜）" required error={errors.unitPrice?.message}>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                ¥
              </span>
              <Input
                {...register("unitPrice", { valueAsNumber: true })}
                type="number"
                min={0}
                step={1}
                placeholder="150000"
                className={cn(inputClass, "pl-8 text-lg font-semibold tabular-nums")}
              />
            </div>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="カテゴリ" error={errors.category?.message}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <CategorySelect
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  disabled={isSubmitting}
                />
              )}
            />
          </Field>
          <Field label="税率" error={errors.taxRate?.message}>
            <select
              {...register("taxRate", { valueAsNumber: true })}
              className={selectClass}
            >
              {TAX_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Controller
          name="isFavorite"
          control={control}
          render={({ field }) => (
            <div className="flex items-center justify-between rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Star
                  className={cn(
                    "size-4",
                    field.value
                      ? "fill-amber-400 text-amber-400"
                      : "text-zinc-400"
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    お気に入り
                  </p>
                  <p className="text-xs text-zinc-500">
                    よく使う項目として一覧の上部に表示
                  </p>
                </div>
              </div>
              <Switch
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked)}
              />
            </div>
          )}
        />
      </FormSection>

      <FormSection
        title="補足説明"
        description="見積の明細行に表示される説明文です（任意）"
      >
        <Field label="説明" error={errors.description?.message}>
          <Textarea
            {...register("description")}
            placeholder="コーポレートサイト制作（10ページ程度）"
            rows={3}
            className="min-h-[100px] resize-none rounded-xl border-zinc-200/80 text-base"
          />
        </Field>
        <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
          保存後、見積作成時にこの項目をすぐ呼び出せます。テンプレの単価を変更しても、過去の見積・請求の金額は変わりません。
        </p>
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

const selectClass =
  "flex h-11 w-full rounded-xl border border-zinc-200/80 bg-white px-3 text-base text-zinc-900 outline-none focus-visible:border-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-200";

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
