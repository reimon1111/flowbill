"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Customer, ItemTemplate } from "@/lib/types";
import {
  recurringFormDefaults,
  recurringFormSchema,
  type RecurringFormValues,
} from "@/lib/validations/recurring";
import { CustomerCombobox } from "@/components/projects/customer-combobox";
import {
  QuoteItemsEditor,
  type QuoteItemDraft,
} from "@/components/quotes/quote-items-editor";
import { ItemTemplatePicker } from "@/components/quotes/item-template-picker";
import { formatCurrency } from "@/lib/format";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import {
  clampBillingDay,
  computeInitialNextBillingDate,
} from "@/lib/recurring-utils";

function compute(items: QuoteItemDraft[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice * i.taxRate,
    0
  );
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

function toFormItems(items: QuoteItemDraft[]): RecurringFormValues["items"] {
  return items.map((it, idx) => ({
    itemTemplateId: it.itemTemplateId,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit || DEFAULT_UNIT,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
}

export function RecurringForm({
  customers,
  itemTemplates,
  defaultValues,
  defaultItems,
  onSubmit,
  submitLabel = "保存する",
  disableStatusFields,
}: {
  customers: Customer[];
  itemTemplates: ItemTemplate[];
  defaultValues?: Partial<RecurringFormValues>;
  defaultItems?: QuoteItemDraft[];
  onSubmit: (values: RecurringFormValues) => Promise<void>;
  submitLabel?: string;
  disableStatusFields?: boolean;
}) {
  const form = useForm<RecurringFormValues>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: {
      ...recurringFormDefaults,
      billingDay: 25,
      nextBillingDate: computeInitialNextBillingDate(25),
      ...defaultValues,
      items: [],
    },
  });

  const [items, setItems] = useState<QuoteItemDraft[]>(defaultItems ?? []);
  const [billingDay, setBillingDay] = useState(
    defaultValues?.billingDay ?? 25
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    defaultValues?.customerId ?? ""
  );
  const totals = useMemo(() => compute(items), [items]);

  useEffect(() => {
    form.setValue("items", toFormItems(items), { shouldValidate: true });
  }, [items, form]);

  useEffect(() => {
    form.setValue("billingDay", billingDay);
    if (!disableStatusFields) {
      const next = computeInitialNextBillingDate(billingDay);
      form.setValue("nextBillingDate", next);
    }
  }, [billingDay, disableStatusFields, form]);

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
  };

  const handleSave = form.handleSubmit(async (values) => {
    await onSubmit({ ...values, items: toFormItems(items) });
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-6">
        <FormSection
          title="基本情報"
          description="HP保守費・月額管理費など、毎月発生する請求を登録します"
        >
          <div className="space-y-5">
            <CustomerCombobox
              customers={customers}
              value={selectedCustomerId}
              onChange={(id) => {
                setSelectedCustomerId(id);
                form.setValue("customerId", id, { shouldValidate: true });
              }}
              error={form.formState.errors.customerId?.message}
            />

            <Field label="タイトル" required error={form.formState.errors.title?.message}>
              <Input
                {...form.register("title")}
                placeholder="HP保守（月額）"
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="毎月の請求日"
                required
                error={form.formState.errors.billingDay?.message}
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    value={billingDay}
                    onChange={(e) => setBillingDay(clampBillingDay(Number(e.target.value)))}
                    className={cn(inputClass, "w-24 tabular-nums")}
                    disabled={disableStatusFields}
                  />
                  <span className="text-sm text-zinc-500">日（1〜28）</span>
                </div>
              </Field>

              <Field
                label="次回請求予定日"
                required
                error={form.formState.errors.nextBillingDate?.message}
              >
                <Input
                  type="date"
                  {...form.register("nextBillingDate")}
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="メモ" error={form.formState.errors.memo?.message}>
              <Textarea
                {...form.register("memo")}
                rows={3}
                placeholder="請求内容の補足など"
                className={inputClass}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="明細" description="請求書生成時にこの内容がコピーされます">
          <ItemTemplatePicker templates={itemTemplates} onPick={addFromTemplate} />
          <div className="mt-4">
            <QuoteItemsEditor
              items={items}
              onChange={setItems}
              onRemove={(index) =>
                setItems((prev) => prev.filter((_, i) => i !== index))
              }
            />
          </div>
          {items.length === 0 && (
            <p className="mt-2 text-sm text-amber-700">
              テンプレートから追加するか、明細を入力してください
            </p>
          )}
        </FormSection>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.03]">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            プレビュー
          </p>
          {selectedCustomer && (
            <p className="mt-2 text-sm text-zinc-600">{selectedCustomer.customerName}</p>
          )}
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-zinc-500">小計</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">消費税</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(totals.taxAmount)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-100 pt-2">
              <dt className="font-medium text-zinc-700">合計</dt>
              <dd className="text-lg font-semibold tabular-nums text-zinc-900">
                {formatCurrency(totals.totalAmount)}
              </dd>
            </div>
          </dl>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={form.formState.isSubmitting}
          className="h-11 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
        >
          {form.formState.isSubmitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          <span className="ml-2">{submitLabel}</span>
        </Button>
      </aside>
    </div>
  );
}

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
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
      {error != null && error !== "" && (
        <p className="text-sm text-red-600">{formatFieldErrorMessage(error)}</p>
      )}
    </div>
  );
}

const inputClass =
  "rounded-xl border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.02] focus-visible:ring-zinc-400";
