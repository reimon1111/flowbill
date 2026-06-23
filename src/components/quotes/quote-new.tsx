"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { QuoteForm } from "@/components/quotes/quote-form";
import { createQuote, quoteInputFromForm, updateQuoteStatus } from "@/lib/services/quotes";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import type { QuoteFormValues } from "@/lib/validations/quote";
import { useQuoteStore } from "@/stores/quote-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { todayISO } from "@/lib/quote-dates";
import {
  DEFAULT_QUOTE_EXPIRY_TYPE,
  calculateQuoteExpiryDate,
} from "@/lib/quote-expiry";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { quoteItemsFromProjectTitle } from "@/lib/project-title";

function previewQuoteNumber(issueDate: string) {
  const quotes = useQuoteStore.getState().getQuotes();
  const y = issueDate.slice(0, 4);
  const count = quotes.filter((q) => q.quoteNumber.startsWith(`QT-${y}-`)).length + 1;
  return `QT-${y}-${String(count).padStart(4, "0")}`;
}

export function NewQuoteClient({ projectId }: { projectId?: string }) {
  const router = useRouter();
  useQuoteStore((s) => s.quotes);
  const companySettings = useCompanySettingsStore((s) => s.settings);

  const project = useProjectStore((s) =>
    projectId ? s.getProjectById(projectId) : undefined
  );
  const customer = useCustomerStore((s) =>
    project ? s.getCustomerById(project.customerId) : undefined
  );
  const itemTemplates = useItemTemplateStore((s) => s.itemTemplates);

  const issueDate = todayISO();
  const defaultExpiryType =
    companySettings.quoteDefaultExpiryType ?? DEFAULT_QUOTE_EXPIRY_TYPE;
  const expiryDate = calculateQuoteExpiryDate(issueDate, defaultExpiryType);

  const quoteNumber = useMemo(
    () => previewQuoteNumber(issueDate),
    [issueDate]
  );

  const defaultItems = useMemo(() => {
    const fromStore = useProjectItemStore
      .getState()
      .getByProjectId(project?.id ?? "")
      .map((it) => ({
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
      }));
    if (fromStore.length > 0) return fromStore;
    if (!project) return [];
    return quoteItemsFromProjectTitle(project.projectName, project.amount ?? 0).map(
      (line, idx) => ({
        itemTemplateId: null,
        name: line.name,
        description: "",
        width: "",
        height: "",
        quantity: 1,
        unit: DEFAULT_UNIT,
        unitPrice: line.unitPrice,
        taxRate: 0.1 as const,
        sortOrder: idx,
      })
    );
  }, [project]);

  if (!projectId || !project || !customer) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-8 py-10">
        <PageHeader
          title="見積を作成"
          description="案件から作成すると顧客・案件情報が自動反映されます"
        />
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
          <p className="text-sm text-zinc-600">
            まずは案件詳細から「見積を作成」を押してください。
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-flex rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            案件一覧へ
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async (values: QuoteFormValues) => {
    const quote = await createQuote(quoteInputFromForm(values));
    toast.success("見積を保存しました", { description: quote.quoteNumber });
    router.push(`/quotes/${quote.id}`);
  };

  const handleSend = async (values: QuoteFormValues) => {
    const quote = await createQuote(quoteInputFromForm(values));
    await updateQuoteStatus(quote.id, "sent");
    toast.success("見積を提出済みにしました", {
      description: "案件ステータスも更新しました",
    });
    router.push(`/quotes/${quote.id}`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-10 pb-24">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        案件詳細に戻る
      </Link>

      <PageHeader
        title="見積を作成"
        description={`${project.projectName} / ${customer.customerName}`}
      />

      <QuoteForm
        projectId={project.id}
        customer={customer}
        projectName={project.projectName}
        quoteNumber={quoteNumber}
        itemTemplates={itemTemplates}
        defaultExpiryType={defaultExpiryType}
        defaultValues={{
          projectId: project.id,
          customerId: customer.id,
          issueDate,
          expiryType: defaultExpiryType,
          expiryDate,
          memo: companySettings.quoteMemoTemplate ?? "",
          paymentTerms: companySettings.paymentTerms ?? "",
        }}
        defaultItems={defaultItems}
        onSubmit={handleSave}
        onSubmitAndSend={handleSend}
        submitLabel="保存する"
        sendLabel="提出済みにする"
      />
    </div>
  );
}
