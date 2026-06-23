"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Customer } from "@/lib/types";
import {
  invoiceFormDefaults,
  invoiceFormSchema,
  type InvoiceFormValues,
} from "@/lib/validations/invoice";
import { InvoiceItemsEditor, type InvoiceItemDraft } from "@/components/invoices/invoice-items-editor";
import { formatCurrency } from "@/lib/format";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import { useBankAccountStore } from "@/stores/bank-account-store";
import { formatBankAccountOptionLabel } from "@/lib/services/bank-accounts";

function compute(items: InvoiceItemDraft[]) {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice * i.taxRate,
    0
  );
  const totalAmount = subtotal + taxAmount;
  return { subtotal, taxAmount, totalAmount };
}

function toFormItems(items: InvoiceItemDraft[]): InvoiceFormValues["items"] {
  return items.map((it, idx) => ({
    quoteItemId: it.quoteItemId,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit || "一式",
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));
}

export function InvoiceForm({
  projectId,
  customer,
  projectName,
  invoiceNumber,
  quoteNumber,
  defaultValues,
  defaultItems,
  onSubmit,
  submitLabel = "保存する",
}: {
  projectId: string;
  customer: Customer;
  projectName: string;
  invoiceNumber: string;
  quoteNumber: string;
  defaultValues?: Partial<InvoiceFormValues>;
  defaultItems?: InvoiceItemDraft[];
  onSubmit: (values: InvoiceFormValues) => Promise<void>;
  submitLabel?: string;
}) {
  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      ...invoiceFormDefaults,
      projectId,
      customerId: customer.id,
      ...defaultValues,
      items: [],
    },
  });

  const [items, setItems] = useState<InvoiceItemDraft[]>(defaultItems ?? []);
  const bankAccountsRaw = useBankAccountStore((s) => s.bankAccounts);
  const bankAccounts = useMemo(
    () =>
      [...bankAccountsRaw].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) ||
          a.bankName.localeCompare(b.bankName, "ja")
      ),
    [bankAccountsRaw]
  );
  const totals = useMemo(() => compute(items), [items]);
  const bankAccountId = form.watch("bankAccountId");

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
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                顧客
              </p>
              <p className="mt-2 font-semibold text-zinc-900">
                {customer.customerName}
              </p>
              <p className="mt-1 text-sm text-zinc-500">
                {customer.contactName || "—"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                請求書番号
              </p>
              <p className="mt-2 text-sm font-normal text-zinc-600">{invoiceNumber}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                元見積
              </p>
              <p className="mt-2 font-semibold text-zinc-900">{quoteNumber}</p>
            </div>
            <div className="rounded-xl border border-zinc-200/80 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                ステータス
              </p>
              <p className="mt-2 font-semibold text-zinc-900">下書き</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
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
              <p className="text-sm font-medium text-zinc-700">支払期限 *</p>
              <Input
                type="date"
                {...form.register("dueDate")}
                className="h-11 rounded-xl border-zinc-200/80 text-base"
              />
              {form.formState.errors.dueDate?.message && (
                <p className="text-sm text-red-600">
                  {formatFieldErrorMessage(form.formState.errors.dueDate.message)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">支払い条件</p>
              <Input
                {...form.register("paymentTerms")}
                placeholder="例: 請求書発行後14日以内"
                className="h-11 rounded-xl border-zinc-200/80 text-base"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">振込口座</p>
              <Controller
                name="bankAccountId"
                control={form.control}
                render={({ field }) => (
                  <select
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? e.target.value : null)
                    }
                    className="h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 text-base text-zinc-800 shadow-sm focus:border-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200/80"
                  >
                    <option value="">全口座を表示</option>
                    {bankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {formatBankAccountOptionLabel(account)}
                      </option>
                    ))}
                  </select>
                )}
              />
              {bankAccountId ? (
                <p className="text-xs text-zinc-500">
                  選択した口座のみ請求書に表示されます
                </p>
              ) : (
                <p className="text-xs text-zinc-500">
                  登録済みの全口座を請求書に表示します
                </p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="明細（見積からコピー）"
          description="必要な場合のみ編集してください。合計はリアルタイムで更新されます。"
        >
          {form.formState.errors.items?.message && (
            <p className="text-sm text-red-600">
              {String(form.formState.errors.items.message)}
            </p>
          )}
          <InvoiceItemsEditor
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
            placeholder="補足や振込条件など（任意）"
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
          </div>

          <p className="text-xs text-zinc-400">
            発行済みにすると、案件は「請求済」へ進みます。
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

