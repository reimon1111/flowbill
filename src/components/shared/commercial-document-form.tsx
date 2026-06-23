"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/types";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import {
  QuoteItemsEditor,
  type QuoteItemDraft,
} from "@/components/quotes/quote-items-editor";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { formatCurrency } from "@/lib/format";
import { formatContactWithSama } from "@/lib/format-contact";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import {
  commercialDocumentFormDefaults,
  commercialDocumentFormSchema,
  orderDocumentFormSchema,
  type CommercialDocumentFormValues,
  type OrderDocumentFormValues,
} from "@/lib/validations/commercial-document";

function compute(items: QuoteItemDraft[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice * i.taxRate,
    0
  );
  return { subtotal, taxAmount, totalAmount: subtotal + taxAmount };
}

function toFormItems(items: QuoteItemDraft[]): CommercialDocumentFormValues["items"] {
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

export function CommercialDocumentForm({
  kind,
  projectId,
  customer,
  projectName,
  constructionSite,
  documentNumber,
  defaultValues,
  defaultItems,
  onSubmit,
  submitLabel = "保存する",
}: {
  kind: DocumentKind;
  projectId: string;
  customer: Customer;
  projectName: string;
  constructionSite?: string;
  documentNumber: string;
  defaultValues?: Partial<CommercialDocumentFormValues | OrderDocumentFormValues>;
  defaultItems?: QuoteItemDraft[];
  onSubmit: (
    values: CommercialDocumentFormValues | OrderDocumentFormValues
  ) => Promise<void>;
  submitLabel?: string;
}) {
  const labels = getDocumentLabels(kind);
  const isOrder = kind === "order";
  const form = useForm<CommercialDocumentFormValues | OrderDocumentFormValues>({
    resolver: zodResolver(
      isOrder ? orderDocumentFormSchema : commercialDocumentFormSchema
    ),
    defaultValues: {
      ...commercialDocumentFormDefaults,
      projectId,
      customerId: customer.id,
      ...(isOrder ? { recipientName: "" } : {}),
      ...defaultValues,
      items: [],
    },
  });

  const [items, setItems] = useState<QuoteItemDraft[]>(defaultItems ?? []);
  const totals = useMemo(() => compute(items), [items]);

  useEffect(() => {
    form.setValue("items", toFormItems(items), { shouldValidate: true });
  }, [items, form]);

  const handleSave = form.handleSubmit(async (values) => {
    await onSubmit({ ...values, items: toFormItems(items) });
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
      <div className="space-y-6">
        <FormSection title="案件・顧客">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                案件名
              </p>
              <p className="mt-2 font-semibold text-zinc-900">{projectName}</p>
              {constructionSite?.trim() ? (
                <p className="mt-1 text-sm text-zinc-600">
                  工事場所：{constructionSite.trim()}
                </p>
              ) : null}
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
                {labels.numberLabel}
              </p>
              <p className="mt-2 text-sm font-normal text-zinc-600">{documentNumber}</p>
            </div>
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
          </div>

          {labels.showPaymentTerms ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">支払い条件</p>
              <Input
                {...form.register("paymentTerms")}
                placeholder="例: 納品後お支払い"
                className="h-11 max-w-xl rounded-xl border-zinc-200/80 text-base"
              />
            </div>
          ) : null}
        </FormSection>

        {isOrder ? (
          <FormSection
            title="注文書の宛名"
            description="相手業者が自社へ注文する書類です。印刷後に手書きで記入する場合は空欄のまま保存できます。"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">注文書宛名</p>
              <Input
                {...form.register("recipientName")}
                placeholder="例: ボーダレス 御中 / 長野営業所 御中 / 現場責任者 青木玲門 様"
                className="h-11 max-w-xl rounded-xl border-zinc-200/80 text-base"
              />
              {"recipientName" in form.formState.errors &&
              form.formState.errors.recipientName?.message ? (
                <p className="text-sm text-red-600">
                  {formatFieldErrorMessage(
                    form.formState.errors.recipientName.message
                  )}
                </p>
              ) : null}
              <p className="text-xs text-zinc-500">
                空欄の場合、帳票には手書き用の記入スペース（下線）が表示されます。
              </p>
            </div>
          </FormSection>
        ) : null}

        <FormSection title="明細" description="必要な場合のみ編集してください。">
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
          <Button
            type="button"
            className="h-11 w-full gap-2 rounded-xl bg-zinc-900 hover:bg-zinc-800"
            disabled={form.formState.isSubmitting}
            onClick={() => void handleSave()}
          >
            {form.formState.isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            {submitLabel}
          </Button>
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
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold text-zinc-900")}>
        {value}
      </span>
    </div>
  );
}
