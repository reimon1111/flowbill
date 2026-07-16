"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { FormSection } from "@/components/shared/form-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/types";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import {
  QuoteItemsEditor,
  type QuoteItemDraft,
} from "@/components/quotes/quote-items-editor";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { DiscountSection } from "@/components/shared/discount-section";
import { DocumentTotalsSummary } from "@/components/shared/document-totals-summary";
import { CounterpartyContactFieldsEditor } from "@/components/shared/counterparty-contact-fields";
import { CustomerHonorificSelect } from "@/components/shared/customer-honorific-select";
import { discountFormDefaults } from "@/lib/validations/discount";
import { counterpartyContactFormDefaults } from "@/lib/validations/counterparty-contact";
import { DEFAULT_CUSTOMER_HONORIFIC } from "@/lib/customer-honorific";
import type { CustomerHonorific } from "@/lib/customer-honorific";
import { formatContactWithSama } from "@/lib/format-contact";
import { formatFieldErrorMessage } from "@/lib/form-error-message";
import {
  commercialDocumentFormDefaults,
  commercialDocumentFormSchema,
  orderDocumentFormSchema,
  type CommercialDocumentFormValues,
  type OrderDocumentFormValues,
} from "@/lib/validations/commercial-document";

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
  const discountLabel =
    useWatch({ control: form.control, name: "discountLabel" }) ??
    discountFormDefaults.discountLabel;
  const discountAmount =
    useWatch({ control: form.control, name: "discountAmount" }) ??
    discountFormDefaults.discountAmount;
  const customerContactName =
    useWatch({ control: form.control, name: "customerContactName" }) ??
    counterpartyContactFormDefaults.customerContactName;
  const customerDepartment =
    useWatch({ control: form.control, name: "customerDepartment" }) ??
    counterpartyContactFormDefaults.customerDepartment;
  const customerPosition =
    useWatch({ control: form.control, name: "customerPosition" }) ??
    counterpartyContactFormDefaults.customerPosition;
  const customerHonorific =
    ((useWatch({ control: form.control, name: "customerHonorific" }) as
      | CustomerHonorific
      | undefined) ?? DEFAULT_CUSTOMER_HONORIFIC);
  const totalsItems = useMemo(
    () =>
      items.map((item) => ({
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate,
      })),
    [items]
  );

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

        <FormSection title="先方担当者" description="帳票の宛名に表示されます（任意）。">
          {!isOrder ? (
            <CustomerHonorificSelect
              value={customerHonorific}
              onChange={(next) =>
                form.setValue("customerHonorific", next, {
                  shouldValidate: true,
                })
              }
              disabled={form.formState.isSubmitting}
              error={
                "customerHonorific" in form.formState.errors
                  ? form.formState.errors.customerHonorific?.message
                  : undefined
              }
              className="max-w-xs"
            />
          ) : null}
          <CounterpartyContactFieldsEditor
            value={{
              customerContactName,
              customerDepartment,
              customerPosition,
            }}
            onChange={(next) => {
              form.setValue("customerContactName", next.customerContactName, {
                shouldValidate: true,
              });
              form.setValue("customerDepartment", next.customerDepartment, {
                shouldValidate: true,
              });
              form.setValue("customerPosition", next.customerPosition, {
                shouldValidate: true,
              });
            }}
            disabled={form.formState.isSubmitting}
            errors={{
              customerContactName:
                form.formState.errors.customerContactName?.message,
              customerDepartment:
                form.formState.errors.customerDepartment?.message,
              customerPosition: form.formState.errors.customerPosition?.message,
            }}
          />
        </FormSection>

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

        <FormSection title="値引き">
          <DiscountSection
            value={{ discountLabel, discountAmount }}
            onChange={(next) => {
              form.setValue("discountLabel", next.discountLabel, {
                shouldValidate: true,
              });
              form.setValue("discountAmount", next.discountAmount, {
                shouldValidate: true,
              });
            }}
            disabled={form.formState.isSubmitting}
            amountError={form.formState.errors.discountAmount?.message}
            labelError={form.formState.errors.discountLabel?.message}
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
          <DocumentTotalsSummary
            items={totalsItems}
            discount={{ discountLabel, discountAmount }}
          />
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

