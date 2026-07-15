"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { resolveRouteId } from "@/lib/route-params";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { formatSupabaseError } from "@/lib/db/errors";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { getInvoiceById, getInvoiceItems, invoiceInputFromForm, updateInvoice } from "@/lib/services/invoices";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import type { InvoiceFormValues } from "@/lib/validations/invoice";
import type { InvoiceItemDraft } from "@/components/invoices/invoice-items-editor";
import { PageContentLoader } from "@/components/shared/page-content-loader";

export function EditInvoiceClient({ invoiceId: invoiceIdProp }: { invoiceId?: string }) {
  const router = useRouter();
  const params = useParams();
  const invoiceId = invoiceIdProp || resolveRouteId(params.id);
  useInvoiceStore((s) => s.invoices);
  useInvoiceStore((s) => s.invoiceItems);
  useQuoteStore((s) => s.quotes);

  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<InvoiceFormValues>();
  const [items, setItems] = useState<InvoiceItemDraft[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [quoteNumber, setQuoteNumber] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const customer = useCustomerStore((s) =>
    customerId ? s.getCustomerById(customerId) : undefined
  );

  useEffect(() => {
    if (!invoiceId) {
      router.replace("/invoices");
      return;
    }

    async function load() {
      const inv = await getInvoiceById(invoiceId);
      if (!inv) {
        router.replace("/invoices");
        return;
      }
      const its = await getInvoiceItems(invoiceId);
      const project = useProjectStore.getState().getProjectById(inv.projectId);
      const cust = useCustomerStore.getState().getCustomerById(inv.customerId);
      const quote = useQuoteStore.getState().getQuoteById(inv.quoteId);
      if (!project || !cust || !quote) {
        router.replace("/invoices");
        return;
      }

      setProjectName(project.projectName);
      setInvoiceNumber(inv.invoiceNumber);
      setQuoteNumber(quote.quoteNumber);
      setProjectId(inv.projectId);
      setCustomerId(inv.customerId);

      setValues({
        projectId: inv.projectId,
        customerId: inv.customerId,
        quoteId: inv.quoteId,
        issueDate: inv.issueDate,
        dueDate: inv.dueDate,
        paymentTerms: inv.paymentTerms,
        bankAccountId: inv.bankAccountId,
        memo: inv.memo,
        discountLabel: inv.discountLabel ?? "",
        discountAmount: inv.discountAmount ?? 0,
        customerContactName: inv.customerContactName ?? "",
        customerDepartment: inv.customerDepartment ?? "",
        customerPosition: inv.customerPosition ?? "",
        items: [],
      });

      setItems(
        its.map((it) => ({
          quoteItemId: it.quoteItemId,
          name: it.name,
          description: it.description,
          width: it.width ?? "",
          height: it.height ?? "",
          quantity: it.quantity,
          unit: it.unit,
          unitPrice: it.unitPrice,
          taxRate: it.taxRate,
          sortOrder: it.sortOrder,
        }))
      );
      setLoading(false);
    }
    load();
  }, [invoiceId, router]);

  const handleSave = async (v: InvoiceFormValues) => {
    if (saving) return;
    setSaving(true);
    try {
      const updated = await updateInvoice(invoiceId, invoiceInputFromForm(v));
      if (!updated) {
        toast.error("請求書の更新に失敗しました");
        return;
      }
      toast.success("請求書を更新しました", { description: updated.invoiceNumber });
      router.push(`/invoices/${invoiceId}`);
    } catch (error) {
      toast.error("請求書の更新に失敗しました", {
        description: formatSupabaseError(error),
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading || !values || !customer) {
    return <PageContentLoader />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={`/invoices/${invoiceId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        請求書詳細に戻る
      </Link>

      <PageHeader
        title="請求書を編集"
        description={`${invoiceNumber} / ${projectName}（元見積 ${quoteNumber}）`}
      />

      <InvoiceForm
        projectId={projectId}
        customer={customer}
        projectName={projectName}
        invoiceNumber={invoiceNumber}
        quoteNumber={quoteNumber}
        defaultValues={values}
        defaultItems={items}
        onSubmit={handleSave}
        submitLabel="変更を保存"
      />
    </div>
  );
}

