"use client";

import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { FormSection } from "@/components/shared/form-section";
import { CustomerCombobox } from "@/components/projects/customer-combobox";
import { ProjectItemsEditor, type ProjectItemDraft } from "@/components/projects/project-items-editor";
import { ProjectItemTemplatePicker } from "@/components/projects/project-item-template-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-utils";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { sumLineItemAmounts } from "@/lib/line-item-utils";
import { formatCurrency } from "@/lib/format";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import {
  projectFormDefaults,
  projectFormSchema,
  type ProjectFormValues,
} from "@/lib/validations/project";
import type { Customer, ItemTemplate } from "@/lib/types";
import { useQuoteStore } from "@/stores/quote-store";

type ProjectFormProps = {
  customers: Customer[];
  itemTemplates: ItemTemplate[];
  projectId?: string;
  defaultValues?: Partial<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
  submitLabel?: string;
};

export function ProjectForm({
  customers,
  itemTemplates,
  projectId,
  defaultValues,
  onSubmit,
  submitLabel = "保存する",
}: ProjectFormProps) {
  const hasQuotes =
    projectId != null &&
    useQuoteStore.getState().getQuotesByProjectId(projectId).length > 0;

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { ...projectFormDefaults, ...defaultValues },
  });

  const [items, setItems] = useState<ProjectItemDraft[]>(defaultValues?.items ?? []);

  useEffect(() => {
    setValue("items", items, { shouldValidate: true });
    const total = sumLineItemAmounts(items);
    if (items.length > 0) {
      setValue("amount", total, { shouldValidate: true });
    }
  }, [items, setValue]);

  const subtotal = useMemo(() => sumLineItemAmounts(items), [items]);
  const amountValue = watch("amount");
  const amountMismatch =
    items.length > 0 && amountValue !== subtotal;

  const addFromTemplate = (t: ItemTemplate) => {
    setItems((prev) => [
      ...prev,
      {
        itemTemplateId: t.id,
        name: t.name,
        description: t.description ?? "",
        width: "",
        height: "",
        quantity: 1,
        unit: DEFAULT_UNIT,
        unitPrice: t.unitPrice,
        taxRate: t.taxRate === 10 ? 0.1 : t.taxRate === 8 ? 0.08 : 0,
        sortOrder: prev.length,
      },
    ]);
    toast.success("明細に追加しました", { description: t.name });
  };

  const addBlank = () => {
    setItems((prev) => [
      ...prev,
      {
        itemTemplateId: null,
        name: "",
        description: "",
        width: "",
        height: "",
        quantity: 1,
        unit: DEFAULT_UNIT,
        unitPrice: 0,
        taxRate: 0.1,
        sortOrder: prev.length,
      },
    ]);
  };

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        await onSubmit({ ...values, items });
      })}
      className="space-y-6"
    >
      <FormSection
        title="顧客と案件名"
        description="案件名は一覧表示用のタイトルです。金額の内訳は下の商品明細で登録します。"
      >
        <Controller
          name="customerId"
          control={control}
          render={({ field }) => (
            <CustomerCombobox
              customers={customers}
              value={field.value}
              onChange={field.onChange}
              error={errors.customerId?.message}
            />
          )}
        />
        <Field label="案件名" required error={errors.projectName?.message}>
          <Input
            {...register("projectName")}
            placeholder="例: 〇〇邸 サッシ交換工事"
            className={inputClass}
          />
        </Field>
        <Field label="工事場所" error={errors.constructionSite?.message}>
          <Input
            {...register("constructionSite")}
            placeholder="例: 長野市〇〇町〇〇"
            className={inputClass}
          />
        </Field>
      </FormSection>

      <FormSection
        title="商品明細"
        description="何を・いくつ・いくらで受注するかを登録します。見積作成時にこの内容がそのまま引き継がれます。"
      >
        {hasQuotes && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            この案件にはすでに見積が作成されています。案件明細を変更しても、作成済みの見積内容は自動変更されません。
          </p>
        )}

        <ProjectItemTemplatePicker templates={itemTemplates} onPick={addFromTemplate} />

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            onClick={addBlank}
          >
            <Plus className="size-4" />
            手入力で追加
          </Button>
        </div>

        {items.length > 0 ? (
          <ProjectItemsEditor
            items={items}
            onChange={setItems}
            onRemove={(index) =>
              setItems((prev) =>
                prev
                  .filter((_, i) => i !== index)
                  .map((it, idx) => ({ ...it, sortOrder: idx }))
              )
            }
          />
        ) : (
          <p className="text-sm text-zinc-500">
            テンプレから選ぶか「手入力で追加」してください。
          </p>
        )}

        <p className="text-right text-lg font-semibold tabular-nums text-zinc-900">
          税抜合計：{formatCurrency(subtotal)}
        </p>
        {amountMismatch && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            案件合計（{formatCurrency(amountValue)}）と明細合計（
            {formatCurrency(subtotal)}）が一致しません。保存前に明細を確認してください。
          </p>
        )}
        {errors.items?.message && (
          <p className="text-sm text-red-600">
            {formatFieldErrorMessage(errors.items.message)}
          </p>
        )}
      </FormSection>

      <FormSection title="進捗と納期">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="ステータス" error={errors.status?.message}>
            <select {...register("status")} className={selectClass}>
              {PROJECT_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="金額（税抜）"
            error={errors.amount?.message}
            hint={
              items.length > 0
                ? "商品明細の合計が自動入力されます"
                : "明細がない場合のみ手入力できます"
            }
          >
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                ¥
              </span>
              <Input
                {...register("amount", {
                  valueAsNumber: true,
                  setValueAs: (v) => (v === "" ? 0 : Number(v)),
                })}
                type="number"
                min={0}
                step={1}
                readOnly={items.length > 0}
                className={cn(
                  inputClass,
                  "pl-8 tabular-nums",
                  items.length > 0 && "bg-zinc-50"
                )}
              />
            </div>
          </Field>
        </div>
        <Field label="納期" error={errors.dueDate?.message}>
          <Input {...register("dueDate")} type="date" className={inputClass} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="開始日" error={errors.startDate?.message}>
            <Input {...register("startDate")} type="date" className={inputClass} />
          </Field>
          <Field label="完了予定日" error={errors.endDate?.message}>
            <Input {...register("endDate")} type="date" className={inputClass} />
          </Field>
        </div>
        <Field label="担当者名" error={errors.assigneeName?.message}>
          <Input
            {...register("assigneeName")}
            placeholder="例: 山田 太郎"
            className={inputClass}
          />
        </Field>
      </FormSection>

      <FormSection title="メモ">
        <Field label="メモ" error={errors.memo?.message}>
          <Textarea
            {...register("memo")}
            placeholder="要件・注意事項など"
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
            className="h-11 min-w-[160px] rounded-xl bg-zinc-900 hover:bg-zinc-800"
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
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: unknown;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-zinc-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
      {error ? (
        <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
      ) : null}
    </div>
  );
}
