"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { InvoiceForm } from "@/components/invoices/invoice-form";
import { invoiceInputFromForm, createInvoice } from "@/lib/services/invoices";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { useBankAccountStore } from "@/stores/bank-account-store";
import type { InvoiceFormValues } from "@/lib/validations/invoice";
import { todayISO } from "@/lib/quote-dates";
import { formatSupabaseError } from "@/lib/db/errors";
import type { QuoteRecord } from "@/lib/types";

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function previewInvoiceNumber(issueDate: string) {
  const invoices = useInvoiceStore.getState().getInvoices();
  const y = issueDate.slice(0, 4);
  const count = invoices.filter((q) => q.invoiceNumber.startsWith(`INV-${y}-`)).length + 1;
  return `INV-${y}-${String(count).padStart(4, "0")}`;
}

/** 請求書の元になる見積（承認済み > 提出済み > 下書き） */
function pickSourceQuote(quotes: QuoteRecord[]): QuoteRecord | null {
  return (
    quotes.find((q) => q.status === "accepted") ??
    quotes.find((q) => q.status === "sent") ??
    quotes.find((q) => q.status === "draft") ??
    null
  );
}

export function NewInvoiceClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId") ?? undefined;

  useInvoiceStore((s) => s.invoices);
  const allQuotes = useQuoteStore((s) => s.quotes);
  const companySettings = useCompanySettingsStore((s) => s.settings);
  useBankAccountStore((s) => s.bankAccounts);

  const project = useProjectStore((s) =>
    projectId ? s.getProjectById(projectId) : undefined
  );
  const customer = useCustomerStore((s) =>
    project ? s.getCustomerById(project.customerId) : undefined
  );
  const issueDate = todayISO();
  const dueDate = addDays(issueDate, 30);
  const invoiceNumber = useMemo(() => previewInvoiceNumber(issueDate), [issueDate]);

  const candidates = useMemo(
    () => (projectId ? allQuotes.filter((q) => q.projectId === projectId) : []),
    [projectId, allQuotes]
  );

  const sourceQuote = useMemo(() => pickSourceQuote(candidates), [candidates]);

  if (!projectId || !project || !customer) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <PageHeader
          title="請求書を生成"
          description="案件完了 → 見積から請求書が自然に生まれます"
        />
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
          <p className="text-sm text-zinc-600">
            案件詳細（完了）から「請求書を生成」を押してください。
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

  const canCreateFromProject =
    project.status === "completed";

  if (!canCreateFromProject) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          案件詳細に戻る
        </Link>
        <PageHeader
          title="請求書を生成"
          description={`${project.projectName} / ${customer.customerName}`}
        />
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
          <p className="text-sm text-zinc-600">
            案件を「完了」にしてから、請求書を生成してください。
          </p>
        </div>
      </div>
    );
  }

  if (!sourceQuote) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <Link
          href={`/projects/${projectId}`}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          案件詳細に戻る
        </Link>
        <PageHeader
          title="請求書を生成"
          description={`${project.projectName} / ${customer.customerName}`}
        />
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
          <p className="text-sm text-zinc-600">
            先に見積を作成してください。作成後、この画面から見積明細を請求書にコピーできます。
          </p>
          <Link
            href={`/quotes/new?projectId=${projectId}`}
            className="mt-4 inline-flex rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            見積を作成
          </Link>
        </div>
      </div>
    );
  }

  const quoteNumber = sourceQuote.quoteNumber;
  const quoteItems = useQuoteStore.getState().getQuoteItems(sourceQuote.id);

  const defaultItems = quoteItems.map((it, idx) => ({
    quoteItemId: it.id,
    name: it.name,
    description: it.description,
    width: it.width ?? "",
    height: it.height ?? "",
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    taxRate: it.taxRate,
    sortOrder: it.sortOrder ?? idx,
  }));

  const handleSave = async (values: InvoiceFormValues) => {
    try {
      const invoice = await createInvoice(invoiceInputFromForm(values));
      toast.success("請求書を保存しました", {
        description: `${invoice.invoiceNumber} — 請求書一覧に表示されます`,
      });
      router.push(`/invoices/${invoice.id}`);
    } catch (error) {
      console.error("createInvoice error", error);
      toast.error("請求書の保存に失敗しました", {
        description: formatSupabaseError(error),
      });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 sm:px-6 lg:px-8 lg:py-10">
      <Link
        href={`/projects/${projectId}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        <ArrowLeft className="size-4" />
        案件詳細に戻る
      </Link>

      <PageHeader
        title="請求書を生成"
        description={`${project.projectName} / ${customer.customerName}（元見積 ${quoteNumber}）`}
      />

      {sourceQuote.status === "draft" && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          下書き見積の内容をコピーして請求書を作成します。提出・承認後に送付する運用でも問題ありません。
        </p>
      )}

      <InvoiceForm
        projectId={project.id}
        customer={customer}
        projectName={project.projectName}
        invoiceNumber={invoiceNumber}
        quoteNumber={quoteNumber}
        defaultValues={{
          projectId: project.id,
          customerId: customer.id,
          quoteId: sourceQuote.id,
          issueDate,
          dueDate,
          paymentTerms: companySettings.paymentTerms ?? "",
          bankAccountId: null,
          memo: companySettings.invoiceMemoTemplate ?? "",
        }}
        defaultItems={defaultItems}
        onSubmit={handleSave}
        submitLabel="保存する"
      />
    </div>
  );
}
