"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CustomerForm } from "@/components/customers/customer-form";
import { WriteAccessGate } from "@/components/auth/write-access-gate";
import { PageHeader } from "@/components/shared/page-header";
import {
  createCustomer,
  customerInputFromForm,
} from "@/lib/services/customers";
import type { CustomerFormValues } from "@/lib/validations/customer";

export default function NewCustomerPage() {
  const router = useRouter();

  const handleSubmit = async (values: CustomerFormValues) => {
    const customer = await createCustomer(customerInputFromForm(values));
    toast.success("顧客を登録しました", {
      description: customer.customerName,
    });
    router.push(`/customers/${customer.id}`);
  };

  return (
    <WriteAccessGate>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href="/customers"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        顧客一覧に戻る
      </Link>

      <PageHeader
        title="顧客を登録"
        description="案件・見積作成時に、この情報が自動入力されます"
      />

      <CustomerForm onSubmit={handleSubmit} submitLabel="登録する" />
      </div>
    </WriteAccessGate>
  );
}
