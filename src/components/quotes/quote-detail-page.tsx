"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { QuoteDetail } from "@/components/quotes/quote-detail";
import { PageContentLoader } from "@/components/shared/page-content-loader";
import { ClientErrorBoundary } from "@/components/shared/client-error-boundary";
import { useQuoteStore } from "@/stores/quote-store";
import { useProjectStore } from "@/stores/project-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useAppDataStore } from "@/stores/app-data-store";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveRouteId } from "@/lib/route-params";

export function QuoteDetailClient() {
  const router = useRouter();
  const params = useParams();
  const quoteId = resolveRouteId(params.id);
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);

  const quote = useQuoteStore((s) =>
    quoteId ? s.quotes.find((q) => q.id === quoteId) : undefined
  );
  const quoteItems = useQuoteStore((s) => s.quoteItems);
  const projects = useProjectStore((s) => s.projects);
  const customers = useCustomerStore((s) => s.customers);

  const items = useMemo(
    () =>
      quoteItems
        .filter((it) => it.quoteId === quoteId)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [quoteItems, quoteId]
  );
  const project = useMemo(
    () => (quote ? projects.find((p) => p.id === quote.projectId) : undefined),
    [projects, quote]
  );
  const customer = useMemo(
    () => (quote ? customers.find((c) => c.id === quote.customerId) : undefined),
    [customers, quote]
  );

  useEffect(() => {
    if (!hasInitialized || !quoteId) return;
    if (!quote) router.replace("/quotes");
  }, [hasInitialized, quote, quoteId, router]);

  if (!quoteId) {
    return null;
  }

  if (!hasInitialized || !quote) {
    return <PageContentLoader />;
  }

  if (!project || !customer) {
    return (
      <div className="mx-auto max-w-lg px-8 py-16 text-center">
        <p className="font-semibold text-zinc-900">関連データが見つかりません</p>
        <p className="mt-2 text-sm text-zinc-500">
          顧客または案件が読み込めていません。一覧から開き直してください。
        </p>
        <Link
          href="/quotes"
          className={cn(buttonVariants(), "mt-6 rounded-xl bg-zinc-900 text-white")}
        >
          見積一覧へ
        </Link>
      </div>
    );
  }

  return (
    <ClientErrorBoundary title="見積詳細の表示に失敗しました" backHref="/quotes" backLabel="見積一覧へ">
      <QuoteDetail
        quote={quote}
        customer={customer}
        projectName={project.projectName}
        constructionSite={project.constructionSite}
        items={items}
      />
    </ClientErrorBoundary>
  );
}
