"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar, ListFilterChip } from "@/components/common/list-toolbar";
import { ListPagination } from "@/components/common/list-pagination";
import {
  buildYearFilterOptions,
  collectYearsFromDates,
  matchesYearFilter,
  paginateList,
  type YearFilterValue,
} from "@/lib/list-query";
import {
  QUOTE_SORT_DEFAULT,
  QUOTE_SORT_KEYS,
  QUOTE_SORT_OPTIONS,
  sortQuotes,
  type QuoteSortKey,
} from "@/lib/list-sorts";
import { useListSort } from "@/hooks/use-list-sort";
import { useListPage } from "@/hooks/use-list-page";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuoteListItem, QuoteStatus } from "@/lib/types";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { QuoteExpiryListLabel } from "@/components/quotes/quote-expiry-fields";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatContactWithSama } from "@/lib/format-contact";
import { getQuoteDisplayTotal } from "@/lib/quote-display";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useAppDataStore } from "@/stores/app-data-store";
import {
  findProjectById,
  resolveProjectNameFromStore,
  UNKNOWN_CUSTOMER_LABEL,
} from "@/lib/project-display";
import {
  DocumentListActions,
  ListPageContainer,
  listCardsClass,
  listTableBodyClass,
  listTableHeaderClass,
  quoteListGridClass,
} from "@/components/shared/document-list-row";

const STATUS_FILTERS: Array<{ value: QuoteStatus | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "draft", label: "下書き" },
  { value: "sent", label: "提出済み" },
  { value: "accepted", label: "承認" },
  { value: "rejected", label: "否認" },
];

export function QuoteList() {
  const canWrite = useCanWriteBusinessData();
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);
  const quotes = useQuoteStore((s) => s.quotes);
  const quoteItems = useQuoteStore((s) => s.quoteItems);
  const projects = useProjectStore((s) => s.projects);
  const customers = useCustomerStore((s) => s.customers);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuoteStatus | "all">("all");
  const [yearFilter, setYearFilter] = useState<YearFilterValue>("all");
  const [sort, setSort] = useListSort<QuoteSortKey>(
    "quotes",
    QUOTE_SORT_DEFAULT,
    QUOTE_SORT_KEYS
  );
  const [includeArchivedProjects, setIncludeArchivedProjects] = useState(false);
  const { page, setPage } = useListPage(
    search,
    status,
    yearFilter,
    sort,
    includeArchivedProjects
  );

  const listItems = useMemo(() => {
    if (!hasInitialized) return [];
    return quotes.map((q) => {
      const p = findProjectById(projects, q.projectId);
      const c = customers.find((cu) => cu.id === q.customerId);
      const items = quoteItems.filter((it) => it.quoteId === q.id);
      return {
        ...q,
        projectName: resolveProjectNameFromStore(q.projectId, projects, {
          documentType: "quote",
          documentId: q.id,
        }),
        customerName: c?.customerName ?? UNKNOWN_CUSTOMER_LABEL,
        displayTotal: getQuoteDisplayTotal(q, items),
        projectArchived: p?.archived ?? false,
      };
    });
  }, [hasInitialized, quotes, quoteItems, projects, customers]);

  const yearOptions = useMemo(
    () =>
      buildYearFilterOptions(
        collectYearsFromDates(listItems.map((q) => q.issueDate))
      ),
    [listItems]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = listItems.filter((qt) => {
      if (!includeArchivedProjects && qt.projectArchived) return false;
      if (status !== "all" && qt.status !== status) return false;
      if (!matchesYearFilter(qt.issueDate, yearFilter)) return false;
      if (!q) return true;
      return (
        qt.quoteNumber.toLowerCase().includes(q) ||
        qt.projectName.toLowerCase().includes(q) ||
        qt.customerName.toLowerCase().includes(q)
      );
    });
    return sortQuotes(items, sort, (item) => item.displayTotal);
  }, [listItems, search, status, yearFilter, sort, includeArchivedProjects]);

  const paged = useMemo(
    () => paginateList(filtered, page),
    [filtered, page]
  );

  return (
    <ListPageContainer>
      <PageHeader
        title="見積"
        description={`${listItems.length}件 — 案件から自然に見積が生まれる体験`}
        action={
          canWrite ? (
            <Link
              href="/quotes/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-10 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              新規見積
            </Link>
          ) : undefined
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="見積番号・案件名・顧客名で検索..."
        yearFilter={yearFilter}
        yearOptions={yearOptions}
        onYearFilterChange={setYearFilter}
        sort={sort}
        sortOptions={QUOTE_SORT_OPTIONS}
        onSortChange={setSort}
        statusFilters={STATUS_FILTERS.map((f) => (
          <ListFilterChip
            key={f.value}
            active={status === f.value}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </ListFilterChip>
        ))}
        extraFilters={
          <ListFilterChip
            active={includeArchivedProjects}
            onClick={() => setIncludeArchivedProjects((v) => !v)}
          >
            アーカイブ案件を含む
          </ListFilterChip>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={
            search || status !== "all" || yearFilter !== "all" || !includeArchivedProjects
              ? "該当する見積が見つかりません"
              : "まだ見積がありません"
          }
          description={
            search || status !== "all" || yearFilter !== "all" || !includeArchivedProjects
              ? "検索・絞り込み条件を変えてお試しください"
              : "案件詳細から見積を作成すると、顧客・案件情報が自動反映されます"
          }
          action={
            !(
              search ||
              status !== "all" ||
              yearFilter !== "all" ||
              !includeArchivedProjects
            ) && (
              <Link
                href="/projects"
                className={cn(
                  buttonVariants(),
                  "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                案件一覧へ
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className={cn(listTableHeaderClass, quoteListGridClass, "px-4")}>
            <span>見積 / 案件</span>
            <span>ステータス</span>
            <span className="text-right">合計</span>
            <span className="text-right">操作</span>
          </div>
          <div className={listTableBodyClass}>
            {paged.items.map((q) => (
              <QuoteRow key={q.id} quote={q} />
            ))}
          </div>

          <div className={listCardsClass}>
            {paged.items.map((q) => (
              <QuoteCard key={q.id} quote={q} />
            ))}
          </div>

          <ListPagination
            page={paged.page}
            totalPages={paged.totalPages}
            totalCount={paged.totalCount}
            onPageChange={setPage}
          />
        </>
      )}
    </ListPageContainer>
  );
}

type QuoteListRow = QuoteListItem & { displayTotal: number; projectArchived: boolean };

function QuoteRow({ quote }: { quote: QuoteListRow }) {
  return (
    <article
      className={cn(
        quoteListGridClass,
        "rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-sm shadow-zinc-900/[0.02] transition-shadow hover:shadow-md hover:shadow-zinc-900/[0.04]",
        quote.projectArchived && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <Link
          href={`/quotes/${quote.id}`}
          className="block truncate font-medium text-zinc-900 hover:underline"
        >
          {quote.quoteNumber}
        </Link>
        <p className="truncate text-sm text-zinc-500">{quote.projectName}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-600">
          {formatContactWithSama(quote.customerName)}
        </p>
      </div>
      <div className="justify-self-start">
        <QuoteStatusBadge status={quote.status} />
      </div>
      <div className="min-w-0 text-right">
        <p className="font-semibold tabular-nums text-zinc-900">
          {formatCurrency(quote.displayTotal)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          発行 {formatDate(quote.issueDate)}
        </p>
        <QuoteExpiryListLabel expiryDate={quote.expiryDate} />
      </div>
      <DocumentListActions
        detailHref={`/quotes/${quote.id}`}
        editHref={`/quotes/${quote.id}/edit`}
        className="justify-self-end"
      />
    </article>
  );
}

function QuoteCard({ quote }: { quote: QuoteListRow }) {
  return (
    <article
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]",
        quote.projectArchived && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/quotes/${quote.id}`}
            className="text-lg font-semibold text-zinc-900 hover:underline"
          >
            {quote.quoteNumber}
          </Link>
          <p className="mt-1 truncate text-sm text-zinc-600">{quote.projectName}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {formatContactWithSama(quote.customerName)}
          </p>
          <div className="mt-3">
            <QuoteStatusBadge status={quote.status} />
          </div>
        </div>
        <p className="shrink-0 text-base font-semibold tabular-nums text-zinc-900">
          {formatCurrency(quote.displayTotal)}
        </p>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
        <span>発行 {formatDate(quote.issueDate)}</span>
        <QuoteExpiryListLabel expiryDate={quote.expiryDate} />
      </div>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/quotes/${quote.id}`}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          詳細
        </Link>
        <Link
          href={`/quotes/${quote.id}/edit`}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          編集
        </Link>
      </div>
    </article>
  );
}

