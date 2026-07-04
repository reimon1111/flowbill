"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import {
  reloadSingleQuoteToStore,
  reloadSingleProjectToStore,
} from "@/lib/db/load-all";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type FetchStatus = "missing" | "error";

export function QuoteDetailClient() {
  const params = useParams();
  const quoteId = resolveRouteId(params.id);
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);

  const quote = useQuoteStore((s) =>
    quoteId ? s.quotes.find((q) => q.id === quoteId) : undefined
  );
  const quoteItems = useQuoteStore((s) => s.quoteItems);
  const projects = useProjectStore((s) => s.projects);
  const customers = useCustomerStore((s) => s.customers);

  const [fetchStatusById, setFetchStatusById] = useState<
    Record<string, FetchStatus>
  >({});

  const needsFetch = Boolean(hasInitialized && quoteId && !quote);
  const fetchStatus = quoteId ? fetchStatusById[quoteId] : undefined;

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
    if (!needsFetch || !quoteId) return;

    let cancelled = false;

    void (async () => {
      try {
        if (isSupabaseConfigured()) {
          const fetched = await reloadSingleQuoteToStore(quoteId);
          if (cancelled) return;
          if (fetched) return;
        }
        if (!cancelled) {
          setFetchStatusById((prev) => ({ ...prev, [quoteId]: "missing" }));
        }
      } catch (error) {
        console.error("QuoteDetailClient fetch", { quoteId, error });
        if (!cancelled) {
          setFetchStatusById((prev) => ({ ...prev, [quoteId]: "error" }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [needsFetch, quoteId]);

  useEffect(() => {
    if (!quote?.projectId || project) return;
    if (!isSupabaseConfigured()) return;

    void reloadSingleProjectToStore(quote.projectId).catch((error) => {
      console.error("QuoteDetailClient reload project", {
        projectId: quote.projectId,
        error,
      });
    });
  }, [quote?.projectId, project]);

  if (!quoteId) {
    return null;
  }

  if (!hasInitialized) {
    return <PageContentLoader label="見積を読み込んでいます..." />;
  }

  if (!quote) {
    if (!fetchStatus) {
      return <PageContentLoader label="見積を読み込んでいます..." />;
    }

    if (fetchStatus === "missing") {
      return (
        <div className="mx-auto max-w-lg px-8 py-16 text-center">
          <p className="font-semibold text-zinc-900">見積が見つかりません</p>
          <p className="mt-2 text-sm text-zinc-500">
            削除されたか、まだ同期されていない可能性があります。
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
      <div className="mx-auto max-w-lg px-8 py-16 text-center">
        <p className="font-semibold text-zinc-900">見積の読み込みに失敗しました</p>
        <p className="mt-2 text-sm text-zinc-500">
          通信状況を確認のうえ、再度お試しください。
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

  if (!project || !customer) {
    return (
      <div className="mx-auto max-w-lg px-8 py-16 text-center">
        <p className="font-semibold text-zinc-900">関連データが見つかりません</p>
        <p className="mt-2 text-sm text-zinc-500">
          顧客または案件が読み込めていません。しばらくしてから再度お試しください。
        </p>
        <Link
          href={`/projects/${quote.projectId}`}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "mt-4 rounded-xl"
          )}
        >
          案件詳細へ
        </Link>
        <Link
          href="/quotes"
          className={cn(buttonVariants(), "mt-3 rounded-xl bg-zinc-900 text-white")}
        >
          見積一覧へ
        </Link>
      </div>
    );
  }

  return (
    <ClientErrorBoundary
      title="見積詳細の表示に失敗しました"
      description="画面の表示中に問題が発生しました。しばらくしてから再度お試しください。"
      backHref="/quotes"
      backLabel="見積一覧へ"
    >
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
