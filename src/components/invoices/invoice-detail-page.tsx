"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { InvoiceDetail } from "@/components/invoices/invoice-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useProjectStore } from "@/stores/project-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useAppDataStore } from "@/stores/app-data-store";
import { resolveRouteId } from "@/lib/route-params";

export function InvoiceDetailClient() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = resolveRouteId(params.id);
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);

  const invoice = useInvoiceStore((s) =>
    invoiceId ? s.invoices.find((i) => i.id === invoiceId) : undefined
  );
  const invoiceItems = useInvoiceStore((s) => s.invoiceItems);
  const projects = useProjectStore((s) => s.projects);
  const customers = useCustomerStore((s) => s.customers);
  const quotes = useQuoteStore((s) => s.quotes);

  const items = useMemo(
    () =>
      invoiceItems
        .filter((it) => it.invoiceId === invoiceId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [invoiceItems, invoiceId]
  );
  const project = useMemo(
    () => (invoice ? projects.find((p) => p.id === invoice.projectId) : undefined),
    [projects, invoice]
  );
  const customer = useMemo(
    () => (invoice ? customers.find((c) => c.id === invoice.customerId) : undefined),
    [customers, invoice]
  );
  const quote = useMemo(
    () => (invoice ? quotes.find((q) => q.id === invoice.quoteId) : undefined),
    [quotes, invoice]
  );

  useEffect(() => {
    if (!hasInitialized || !invoiceId) return;
    if (!invoice) router.replace("/invoices");
  }, [hasInitialized, invoice, invoiceId, router]);

  if (!invoiceId) {
    return null;
  }

  if (!hasInitialized || !invoice) {
    return <PageContentLoader />;
  }

  if (!project || !customer || !quote) {
    return (
      <div className="mx-auto max-w-lg px-8 py-16 text-center">
        <p className="font-semibold text-zinc-900">関連データが見つかりません</p>
        <Link href="/invoices" className="mt-4 inline-block text-sm text-zinc-600 underline">
          請求書一覧へ
        </Link>
      </div>
    );
  }

  return (
    <InvoiceDetail
      invoice={invoice}
      customer={customer}
      projectName={project.projectName}
      constructionSite={project.constructionSite}
      quoteNumber={quote.quoteNumber}
      items={items}
    />
  );
}
