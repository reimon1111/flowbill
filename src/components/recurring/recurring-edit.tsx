"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { RecurringStatusBadge } from "@/components/recurring/recurring-status-badge";
import {
  recurringInputFromForm,
  updateRecurring,
} from "@/lib/services/recurring";
import { useCustomerStore } from "@/stores/customer-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useRecurringStore } from "@/stores/recurring-store";
import type { RecurringFormValues } from "@/lib/validations/recurring";
import type { QuoteItemDraft } from "@/components/quotes/quote-items-editor";

export function EditRecurringClient({ recurringId }: { recurringId: string }) {
  const router = useRouter();
  useRecurringStore((s) => s.recurringBillings);

  const recurring = useRecurringStore.getState().getRecurringById(recurringId);
  const items = useRecurringStore.getState().getRecurringItems(recurringId);
  const customers = useCustomerStore((s) => s.customers);
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);

  if (!recurring) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <p className="text-sm text-zinc-600">定期請求が見つかりません。</p>
        <Link href="/recurring-billings" className="mt-4 inline-block text-sm text-zinc-900 underline">
          一覧へ戻る
        </Link>
      </div>
    );
  }

  const defaultItems: QuoteItemDraft[] = items.map((it) => ({
    itemTemplateId: it.itemTemplateId,
    name: it.name,
    description: it.description,
    width: "",
    height: "",
    quantity: it.quantity,
    unit: "式",
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder,
  }));

  const isEnded = recurring.status === "ended";

  const handleSave = async (values: RecurringFormValues) => {
    const updated = await updateRecurring(recurringId, recurringInputFromForm(values));
    if (updated) {
      toast.success("定期請求を更新しました");
      router.push("/recurring-billings");
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/recurring-billings"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        定期請求一覧
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <PageHeader title="定期請求を編集" description={recurring.title} />
        <RecurringStatusBadge status={recurring.status} className="mt-1" />
      </div>

      {isEnded && (
        <p className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          終了した定期請求は内容の編集ができません。
        </p>
      )}

      {!isEnded && (
        <RecurringForm
          customers={customers}
          itemTemplates={itemTemplates}
          defaultValues={{
            customerId: recurring.customerId,
            title: recurring.title,
            billingDay: recurring.billingDay,
            nextBillingDate: recurring.nextBillingDate,
            memo: recurring.memo,
          }}
          defaultItems={defaultItems}
          disableStatusFields={recurring.status === "paused"}
          onSubmit={handleSave}
          submitLabel="更新する"
        />
      )}
    </div>
  );
}
