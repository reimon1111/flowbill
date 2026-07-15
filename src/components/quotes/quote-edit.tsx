"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { QuoteForm } from "@/components/quotes/quote-form";
import { getQuoteById, getQuoteItems, quoteInputFromForm, updateQuote } from "@/lib/services/quotes";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import type { QuoteFormValues } from "@/lib/validations/quote";
import { useQuoteStore } from "@/stores/quote-store";
import type { QuoteExpiryType } from "@/lib/quote-expiry";
import type { QuoteItemDraft } from "@/components/quotes/quote-items-editor";

import { resolveRouteId } from "@/lib/route-params";
import { PageContentLoader } from "@/components/shared/page-content-loader";

export function EditQuoteClient({ quoteId: quoteIdProp }: { quoteId?: string }) {
  const router = useRouter();
  const params = useParams();
  const quoteId = quoteIdProp || resolveRouteId(params.id);
  useQuoteStore((s) => s.quotes);
  useQuoteStore((s) => s.quoteItems);
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);
  const [loading, setLoading] = useState(true);
  const [defaultExpiryType, setDefaultExpiryType] = useState<QuoteExpiryType>("1_month");
  const [values, setValues] = useState<QuoteFormValues>();
  const [items, setItems] = useState<QuoteItemDraft[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [quoteNumber, setQuoteNumber] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");

  const customer = useCustomerStore((s) =>
    customerId ? s.getCustomerById(customerId) : undefined
  );

  useEffect(() => {
    if (!quoteId) {
      router.replace("/quotes");
      return;
    }

    async function load() {
      const q = await getQuoteById(quoteId);
      if (!q) {
        router.replace("/quotes");
        return;
      }
      const its = await getQuoteItems(quoteId);
      const project = useProjectStore.getState().getProjectById(q.projectId);
      const cust = useCustomerStore.getState().getCustomerById(q.customerId);
      if (!project || !cust) {
        router.replace("/quotes");
        return;
      }

      setProjectName(project.projectName);
      setQuoteNumber(q.quoteNumber);
      setProjectId(q.projectId);
      setCustomerId(q.customerId);

      setDefaultExpiryType(q.expiryType);
      setValues({
        projectId: q.projectId,
        customerId: q.customerId,
        issueDate: q.issueDate,
        expiryType: q.expiryType,
        expiryDate: q.expiryDate,
        paymentTerms: q.paymentTerms,
        memo: q.memo,
        discountLabel: q.discountLabel ?? "",
        discountAmount: q.discountAmount ?? 0,
        customerContactName: q.customerContactName ?? "",
        customerDepartment: q.customerDepartment ?? "",
        customerPosition: q.customerPosition ?? "",
        items: [],
      });

      setItems(
        its.map((it) => ({
          itemTemplateId: it.itemTemplateId,
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
  }, [quoteId, router]);

  const handleSave = async (v: QuoteFormValues) => {
    const updated = await updateQuote(quoteId, quoteInputFromForm(v));
    if (!updated) return;
    toast.success("見積を更新しました", { description: updated.quoteNumber });
    router.push(`/quotes/${quoteId}`);
  };

  if (loading || !values || !customer) {
    return <PageContentLoader />;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={`/quotes/${quoteId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        見積詳細に戻る
      </Link>

      <PageHeader
        title="見積を編集"
        description={`${quoteNumber} / ${projectName}`}
      />

      <QuoteForm
        projectId={projectId}
        customer={customer}
        projectName={projectName}
        quoteNumber={quoteNumber}
        itemTemplates={itemTemplates}
        defaultValues={values}
        defaultItems={items}
        defaultExpiryType={defaultExpiryType}
        onSubmit={handleSave}
        submitLabel="変更を保存"
      />
    </div>
  );
}

