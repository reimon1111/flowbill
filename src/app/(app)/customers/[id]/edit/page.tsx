"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { CustomerForm } from "@/components/customers/customer-form";
import { WriteAccessGate } from "@/components/auth/write-access-gate";
import { PageHeader } from "@/components/shared/page-header";
import {
  customerInputFromForm,
  getCustomerById,
  updateCustomer,
} from "@/lib/services/customers";
import type { CustomerFormValues } from "@/lib/validations/customer";
import { useCustomerStore } from "@/stores/customer-store";

export default function EditCustomerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const customers = useCustomerStore((s) => s.customers);

  const [defaultValues, setDefaultValues] = useState<
    CustomerFormValues | undefined
  >();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const customer = await getCustomerById(id);
      if (!customer) {
        router.replace("/customers");
        return;
      }
      setDefaultValues({
        customerName: customer.customerName,
        contactName: customer.contactName,
        email: customer.email,
        phone: customer.phone,
        fax: customer.fax ?? "",
        postalCode: customer.postalCode,
        address: customer.address,
        invoiceDestination: customer.invoiceDestination,
        memo: customer.memo,
      });
      setLoading(false);
    }
    load();
  }, [id, customers, router]);

  const handleSubmit = async (values: CustomerFormValues) => {
    const updated = await updateCustomer(id, customerInputFromForm(values));
    if (!updated) return;
    toast.success("顧客情報を更新しました");
    router.push(`/customers/${id}`);
  };

  if (loading || !defaultValues) {
    return (
      <WriteAccessGate>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-zinc-500">読み込み中...</p>
        </div>
      </WriteAccessGate>
    );
  }

  return (
    <WriteAccessGate>
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={`/customers/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        顧客詳細に戻る
      </Link>

      <PageHeader title="顧客を編集" description={defaultValues.customerName} />

      <CustomerForm
        key={id}
        defaultValues={defaultValues}
        onSubmit={handleSubmit}
        submitLabel="変更を保存"
      />
      </div>
    </WriteAccessGate>
  );
}
