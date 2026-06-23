"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Customer, ItemTemplate } from "@/lib/types";
import {
  quoteFormDefaults,
  quoteFormSchema,
  type QuoteFormValues,
} from "@/lib/validations/quote";
import { QuoteItemsEditor, type QuoteItemDraft } from "@/components/quotes/quote-items-editor";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import { ItemTemplatePicker } from "@/components/quotes/item-template-picker";
import { formatCurrency } from "@/lib/format";
import { formatContactWithSama } from "@/lib/format-contact";
import { QuoteExpiryFields } from "@/components/quotes/quote-expiry-fields";
import {
  DEFAULT_QUOTE_EXPIRY_TYPE,
  calculateQuoteExpiryDate,
  type QuoteExpiryType,
} from "@/lib/quote-expiry";

function compute(items: QuoteItemDraft[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice * i.taxRate,
    0
  );
  const totalAmount = subtotal + taxAmount;
  return { subtotal, taxAmount, totalAmount };
}

function toFormItems(items: QuoteItemDraft[]): QuoteFormValues["items"] {
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

export function QuoteForm({
  projectId,
  customer,
  projectName,
  quoteNumber,
  itemTemplates,
  defaultValues,
  defaultItems,
  defaultExpiryType = DEFAULT_QUOTE_EXPIRY_TYPE,
  onSubmit,
  onSubmitAndSend,
  submitLabel = "保存する",
  sendLabel = "提出済みにする",
}: {
  projectId: string;
  customer: Customer;
  projectName: string;
  quoteNumber: string;
  itemTemplates: ItemTemplate[];
  defaultValues?: Partial<QuoteFormValues>;
  defaultItems?: QuoteItemDraft[];
  /** 会社設定または既存見積のデフォルト有効期限タイプ */
  defaultExpiryType?: QuoteExpiryType;
  onSubmit: (values: QuoteFormValues) => Promise<void>;
  onSubmitAndSend?: (values: QuoteFormValues) => Promise<void>;
  submitLabel?: string;
  sendLabel?: string;
}) {
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: {
      ...quoteFormDefaults,
      projectId,
      customerId: customer.id,
      ...defaultValues,
      items: [],
    },
  });

  const [items, setItems] = useState<QuoteItemDraft[]>(defaultItems ?? []);
  const totals = useMemo(() => compute(items), [items]);
  const issueDate = useWatch({ control: form.control, name: "issueDate" });
  const expiryType = useWatch({ control: form.control, name: "expiryType" });
  const expiryDate = useWatch({ control: form.control, name: "expiryDate" });

  useEffect(() => {
    if (!defaultValues?.expiryType) {
      form.setValue("expiryType", defaultExpiryType, { shouldValidate: true });
    }
  }, [defaultExpiryType, defaultValues?.expiryType, form]);

  useEffect(() => {
    form.setValue("items", toFormItems(items), { shouldValidate: true });
  }, [items, form]);

  useEffect(() => {
    if (!issueDate || !expiryType || expiryType === "custom") return;
    form.setValue(
      "expiryDate",
      calculateQuoteExpiryDate(issueDate, expiryType),
      { shouldValidate: true }
    );
  }, [issueDate, expiryType, form]);

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

  const handleSave = form.handleSubmit(async (values) => {
    await onSubmit({ ...values, items: toFormItems(items) });
  });

  const handleSend = form.handleSubmit(async (values) => {
    if (!onSubmitAndSend) return;
    await onSubmitAndSend({ ...values, items: toFormItems(items) });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-6">
        <FormSection title="案件・顧客" description="再入力なしで見積が作れる設計です">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                案件名
              </p>
              <p className="mt-2 font-semibold text-zinc-900">{projectName}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                顧客
              </p>
              <p className="mt-2 font-semibold text-zinc-900">
                {customer.customerName}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {customer.contactName
                  ? formatContactWithSama(customer.contactName)
                  : "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                見積番号
              </p>
              <p className="mt-2 text-sm font-normal text-zinc-600">{quoteNumber}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                ステータス
              </p>
              <p className="mt-2 font-semibold text-zinc-900">下書き</p>
              <p className="mt-1 text-sm text-zinc-500">
                保存後に提出済みにできます
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2 sm:max-w-xs">
              <p className="text-sm font-medium text-zinc-700">発行日 *</p>
              <Input
                type="date"
                {...form.register("issueDate")}
                className="h-11 rounded-xl border-zinc-200/80 text-base"
              />
              {form.formState.errors.issueDate?.message && (
                <p className="text-sm text-red-600">
                  {formatFieldErrorMessage(form.formState.errors.issueDate.message)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">支払い条件</p>
              <Input
                {...form.register("paymentTerms")}
                placeholder="例: 納品後お支払い"
                className="h-11 max-w-xl rounded-xl border-zinc-200/80 text-base"
              />
            </div>
            <QuoteExpiryFields
              issueDate={issueDate ?? ""}
              expiryType={(expiryType ?? defaultExpiryType) as QuoteExpiryType}
              expiryDate={expiryDate ?? ""}
              onExpiryTypeChange={(type) =>
                form.setValue("expiryType", type, { shouldValidate: true })
              }
              onExpiryDateChange={(date) =>
                form.setValue("expiryDate", date, { shouldValidate: true })
              }
              expiryTypeError={form.formState.errors.expiryType?.message}
              expiryDateError={form.formState.errors.expiryDate?.message}
            />
          </div>
        </FormSection>

        <FormSection
          title="明細"
          description="テンプレを選ぶだけで、30秒で見積が完成する体験を作ります"
        >
          <ItemTemplatePicker templates={itemTemplates} onPick={addFromTemplate} />

          {form.formState.errors.items?.message && (
            <p className="text-sm text-red-600">
              {String(form.formState.errors.items.message)}
            </p>
          )}

          <QuoteItemsEditor
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
        </FormSection>

        <FormSection title="備考">
          <Textarea
            {...form.register("memo")}
            rows={4}
            className="min-h-[120px] resize-none rounded-xl border-zinc-200/80 text-base"
            placeholder="補足や条件など（任意）"
          />
        </FormSection>
      </div>

      <aside className="lg:sticky lg:top-20">
        <div className="space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.03]">
          <p className="text-sm font-semibold text-zinc-900">合計</p>

          <div className="space-y-2 text-sm">
            <Row label="小計" value={formatCurrency(Math.round(totals.subtotal))} />
            <Row label="消費税" value={formatCurrency(Math.round(totals.taxAmount))} />
            <div className="border-t border-zinc-100 pt-3">
              <Row
                label="合計"
                value={formatCurrency(Math.round(totals.totalAmount))}
                strong
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={form.formState.isSubmitting}
              className="h-11 rounded-xl bg-zinc-900 hover:bg-zinc-800"
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  {submitLabel}
                </>
              )}
            </Button>

            {onSubmitAndSend && (
              <Button
                type="button"
                onClick={handleSend}
                disabled={form.formState.isSubmitting}
                variant="outline"
                className="h-11 rounded-xl border-zinc-200"
              >
                <FileText className="size-4" />
                {sendLabel}
              </Button>
            )}
          </div>

          <p className="text-xs text-zinc-400">
            提出済みにすると、案件ステータスが「見積提出済」になります。
          </p>
        </div>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-semibold text-zinc-900" : "font-medium text-zinc-900"
        )}
      >
        {value}
      </span>
    </div>
  );
}

