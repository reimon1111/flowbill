"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
  INVOICE_SORT_DEFAULT,
  INVOICE_SORT_KEYS,
  INVOICE_SORT_OPTIONS,
  sortInvoices,
  type InvoiceSortKey,
} from "@/lib/list-sorts";
import { useListSort } from "@/hooks/use-list-sort";
import { useListPage } from "@/hooks/use-list-page";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InvoiceListItem, InvoiceDocumentStatus } from "@/lib/types";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatContactWithSama } from "@/lib/format-contact";
import { getInvoiceListDisplayStatus } from "@/lib/payment-utils";
import { getBillingStatusTheme } from "@/lib/billing-status-theme";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { useAppDataStore } from "@/stores/app-data-store";
import {
  findProjectById,
  resolveProjectNameFromStore,
  UNKNOWN_CUSTOMER_LABEL,
} from "@/lib/project-display";
import {
  isInvoiceCancelled,
  isInvoiceInDefaultList,
  isInvoiceVisibleInLists,
} from "@/lib/invoice-filters";
import {
  DocumentListActions,
  ListPageContainer,
  invoiceListGridClass,
  listCardsClass,
  listTableBodyClass,
  listTableHeaderClass,
} from "@/components/shared/document-list-row";

const STATUS_FILTERS: Array<{ value: InvoiceDocumentStatus | "all"; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "draft", label: "下書き" },
  { value: "issued", label: "発行済み" },
  { value: "sent", label: "送付済み" },
  { value: "paid", label: "入金済み" },
  { value: "overdue", label: "期限超過" },
  { value: "cancelled", label: "キャンセル" },
];

export function InvoiceList() {
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);
  const invoices = useInvoiceStore((s) => s.invoices);
  const projects = useProjectStore((s) => s.projects);
  const customers = useCustomerStore((s) => s.customers);
  const quotes = useQuoteStore((s) => s.quotes);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<InvoiceDocumentStatus | "all">("all");
  const [yearFilter, setYearFilter] = useState<YearFilterValue>("all");
  const [sort, setSort] = useListSort<InvoiceSortKey>(
    "invoices",
    INVOICE_SORT_DEFAULT,
    INVOICE_SORT_KEYS
  );
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [includeArchivedProjects, setIncludeArchivedProjects] = useState(false);
  const { page, setPage } = useListPage(
    search,
    status,
    yearFilter,
    sort,
    unpaidOnly,
    overdueOnly,
    includeArchivedProjects
  );

  const listItems = useMemo(() => {
    if (!hasInitialized) return [];
    const customerById = new Map(customers.map((c) => [c.id, c]));
    const quoteById = new Map(quotes.map((q) => [q.id, q]));
    return invoices
      .filter(isInvoiceVisibleInLists)
      .map((inv) => {
      const p = findProjectById(projects, inv.projectId);
      const c = customerById.get(inv.customerId);
      const q = quoteById.get(inv.quoteId);
      return {
        ...inv,
        projectName: resolveProjectNameFromStore(inv.projectId, projects, {
          documentType: "invoice",
          documentId: inv.id,
        }),
        customerName: c?.customerName ?? UNKNOWN_CUSTOMER_LABEL,
        quoteNumber: q?.quoteNumber ?? "（不明な見積）",
        projectArchived: p?.archived ?? false,
      };
    });
  }, [hasInitialized, invoices, projects, customers, quotes]);

  const yearOptions = useMemo(
    () =>
      buildYearFilterOptions(
        collectYearsFromDates(listItems.map((inv) => inv.issueDate))
      ),
    [listItems]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = listItems.filter((inv) => {
      if (!includeArchivedProjects && inv.projectArchived) return false;
      const ds = getInvoiceListDisplayStatus(inv);
      if (status === "all") {
        if (!isInvoiceInDefaultList(inv)) return false;
      } else if (status === "cancelled") {
        if (!isInvoiceCancelled(inv)) return false;
      } else if (ds !== status) {
        return false;
      }
      if (unpaidOnly && !["issued", "sent", "overdue"].includes(ds)) return false;
      if (overdueOnly && ds !== "overdue") return false;
      if (!matchesYearFilter(inv.issueDate, yearFilter)) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.projectName.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q)
      );
    });
    return sortInvoices(items, sort);
  }, [
    listItems,
    search,
    status,
    yearFilter,
    sort,
    unpaidOnly,
    overdueOnly,
    includeArchivedProjects,
  ]);

  const paged = useMemo(
    () => paginateList(filtered, page),
    [filtered, page]
  );

  return (
    <ListPageContainer>
      <PageHeader
        title="請求書"
        description={`${listItems.length}件 — 見積から自然に請求が生まれる`}
        action={
          <Link
            href="/projects"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "h-10 rounded-xl"
            )}
          >
            案件から生成
          </Link>
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="請求書番号・案件名・顧客名で検索..."
        yearFilter={yearFilter}
        yearOptions={yearOptions}
        onYearFilterChange={setYearFilter}
        sort={sort}
        sortOptions={INVOICE_SORT_OPTIONS}
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
          <>
            <ListFilterChip active={unpaidOnly} onClick={() => setUnpaidOnly((v) => !v)}>
              未入金のみ
            </ListFilterChip>
            <ListFilterChip active={overdueOnly} onClick={() => setOverdueOnly((v) => !v)}>
              期限超過のみ
            </ListFilterChip>
            <ListFilterChip
              active={includeArchivedProjects}
              onClick={() => setIncludeArchivedProjects((v) => !v)}
            >
              アーカイブ案件を含む
            </ListFilterChip>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={
            search ||
              status !== "all" ||
              yearFilter !== "all" ||
              unpaidOnly ||
              overdueOnly ||
              !includeArchivedProjects
              ? "該当する請求書が見つかりません"
              : "まだ請求書がありません"
          }
          description={
            search ||
              status !== "all" ||
              yearFilter !== "all" ||
              unpaidOnly ||
              overdueOnly ||
              !includeArchivedProjects
              ? "検索・絞り込み条件を変えてお試しください"
              : "案件完了 → 見積から請求書生成、の流れで作成されます"
          }
          action={
            !(
              search ||
              status !== "all" ||
              yearFilter !== "all" ||
              unpaidOnly ||
              overdueOnly ||
              !includeArchivedProjects
            ) && (
              <Link
                href="/projects"
                className={cn(
                  buttonVariants(),
                  "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                完了案件を確認
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className={cn(listTableHeaderClass, invoiceListGridClass, "px-4")}>
            <span>請求書 / 案件</span>
            <span>ステータス</span>
            <span className="text-right">合計</span>
            <span className="text-right">操作</span>
          </div>
          <div className={listTableBodyClass}>
            {paged.items.map((inv) => (
              <InvoiceRow key={inv.id} invoice={inv} />
            ))}
          </div>
          <div className={listCardsClass}>
            {paged.items.map((inv) => (
              <InvoiceCard key={inv.id} invoice={inv} />
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

function InvoiceRow({ invoice }: { invoice: InvoiceListItem & { projectArchived: boolean } }) {
  const status = getInvoiceListDisplayStatus(invoice);
  return (
    <article
      className={cn(
        invoiceListGridClass,
        "rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-sm shadow-zinc-900/[0.02] transition-shadow hover:shadow-md hover:shadow-zinc-900/[0.04]",
        invoice.projectArchived && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <Link
          href={`/invoices/${invoice.id}`}
          className="block truncate font-medium text-zinc-900 hover:underline"
        >
          {invoice.invoiceNumber}
        </Link>
        <p className="truncate text-sm text-zinc-500">{invoice.projectName}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-600">
          {formatContactWithSama(invoice.customerName)}
        </p>
      </div>
      <div className="justify-self-start">
        <InvoiceStatusBadge status={status} />
      </div>
      <div className="min-w-0 text-right">
        <p className="font-semibold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(invoice.totalAmount))}
        </p>
        <p
          className={cn(
            "mt-0.5 text-xs",
            status === "overdue"
              ? getBillingStatusTheme("overdue").textAccentClass
              : "text-zinc-400"
          )}
        >
          発行 {formatDate(invoice.issueDate)} / 期限 {formatDate(invoice.dueDate)}
        </p>
      </div>
      <DocumentListActions
        detailHref={`/invoices/${invoice.id}`}
        editHref={`/invoices/${invoice.id}/edit`}
        className="justify-self-end"
      />
    </article>
  );
}

function InvoiceCard({ invoice }: { invoice: InvoiceListItem & { projectArchived: boolean } }) {
  const canWrite = useCanWriteBusinessData();
  const status = getInvoiceListDisplayStatus(invoice);
  return (
    <article
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]",
        invoice.projectArchived && "opacity-60"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/invoices/${invoice.id}`}
            className="block truncate text-lg font-semibold text-zinc-900 hover:underline"
          >
            {invoice.invoiceNumber}
          </Link>
          <p className="mt-1 truncate text-sm text-zinc-600">{invoice.projectName}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {formatContactWithSama(invoice.customerName)}
          </p>
          <div className="mt-3">
            <InvoiceStatusBadge status={status} />
          </div>
        </div>
        <p className="shrink-0 text-base font-semibold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(invoice.totalAmount))}
        </p>
      </div>
      <p
        className={cn(
          "mt-4 text-sm",
          status === "overdue"
            ? getBillingStatusTheme("overdue").textAccentClass
            : "text-zinc-500"
        )}
      >
        発行 {formatDate(invoice.issueDate)} / 期限 {formatDate(invoice.dueDate)}
      </p>
      <div className="mt-4 flex gap-2">
        <Link
          href={`/invoices/${invoice.id}`}
          className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          詳細
        </Link>
        {canWrite ? (
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            編集
          </Link>
        ) : null}
      </div>
    </article>
  );
}

