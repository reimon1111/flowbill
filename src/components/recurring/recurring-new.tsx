"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { RecurringForm } from "@/components/recurring/recurring-form";
import {
  createRecurring,
  recurringInputFromForm,
} from "@/lib/services/recurring";
import { useCustomerStore } from "@/stores/customer-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import type { RecurringFormValues } from "@/lib/validations/recurring";
import { computeInitialNextBillingDate } from "@/lib/recurring-utils";

export function NewRecurringClient() {
  const router = useRouter();
  const customers = useCustomerStore((s) => s.customers);
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);

  const handleSave = async (values: RecurringFormValues) => {
    const record = await createRecurring(recurringInputFromForm(values));
    toast.success("定期請求を登録しました", { description: record.title });
    router.push("/recurring-billings");
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-10 pb-24">
      <Link
        href="/recurring-billings"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        定期請求一覧
      </Link>

      <PageHeader
        title="定期請求を登録"
        description="HP保守費・月額管理費など、毎月の請求を登録します"
      />

      <RecurringForm
        customers={customers}
        itemTemplates={itemTemplates}
        defaultValues={{
          billingDay: 25,
          nextBillingDate: computeInitialNextBillingDate(25),
        }}
        onSubmit={handleSave}
        submitLabel="登録する"
      />
    </div>
  );
}
