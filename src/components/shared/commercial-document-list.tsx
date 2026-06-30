"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import {
  commercialListGridClass,
  DocumentListActions,
  ListPageContainer,
  listCardsClass,
  listTableBodyClass,
  listTableHeaderClass,
} from "@/components/shared/document-list-row";
import { formatCurrency, formatDate } from "@/lib/format";
import { formatContactWithSama } from "@/lib/format-contact";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import {
  DELIVERY_NOTE_SORT_DEFAULT,
  DELIVERY_NOTE_SORT_KEYS,
  DELIVERY_NOTE_SORT_OPTIONS,
  ORDER_SORT_DEFAULT,
  ORDER_SORT_KEYS,
  ORDER_SORT_OPTIONS,
  RECEIPT_SORT_DEFAULT,
  RECEIPT_SORT_KEYS,
  RECEIPT_SORT_OPTIONS,
  sortCommercialDocuments,
  type CommercialListSortItem,
  type DeliveryNoteSortKey,
  type OrderSortKey,
  type ReceiptSortKey,
} from "@/lib/list-sorts";
import { useListSort } from "@/hooks/use-list-sort";
import { cn } from "@/lib/utils";

export type CommercialListRow = CommercialListSortItem & {
  id: string;
  documentNumber: string;
  projectName: string;
  customerName: string;
};

function sortConfigForKind(kind: DocumentKind) {
  switch (kind) {
    case "order":
      return {
        listId: "orders",
        defaultSort: ORDER_SORT_DEFAULT,
        keys: ORDER_SORT_KEYS,
        options: ORDER_SORT_OPTIONS,
      } as const;
    case "delivery_note":
      return {
        listId: "delivery-notes",
        defaultSort: DELIVERY_NOTE_SORT_DEFAULT,
        keys: DELIVERY_NOTE_SORT_KEYS,
        options: DELIVERY_NOTE_SORT_OPTIONS,
      } as const;
    case "receipt":
      return {
        listId: "receipts",
        defaultSort: RECEIPT_SORT_DEFAULT,
        keys: RECEIPT_SORT_KEYS,
        options: RECEIPT_SORT_OPTIONS,
      } as const;
    default:
      return {
        listId: "commercial",
        defaultSort: ORDER_SORT_DEFAULT,
        keys: ORDER_SORT_KEYS,
        options: ORDER_SORT_OPTIONS,
      } as const;
  }
}

function basePathForKind(kind: "order" | "delivery_note" | "receipt"): string {
  switch (kind) {
    case "order":
      return "/orders";
    case "delivery_note":
      return "/delivery-notes";
    case "receipt":
      return "/receipts";
  }
}

function CommercialDocumentRow({
  row,
  basePath,
}: {
  row: CommercialListRow;
  basePath: string;
}) {
  return (
    <article
      className={cn(
        commercialListGridClass,
        "rounded-xl border border-zinc-200/80 bg-white px-4 py-3.5 shadow-sm shadow-zinc-900/[0.02] transition-shadow hover:shadow-md hover:shadow-zinc-900/[0.04]"
      )}
    >
      <div className="min-w-0">
        <Link
          href={`${basePath}/${row.id}`}
          className="block truncate font-medium text-zinc-900 hover:underline"
        >
          {row.documentNumber}
        </Link>
        <p className="truncate text-sm text-zinc-500">{row.projectName}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-600">
          {formatContactWithSama(row.customerName)}
        </p>
      </div>
      <div className="min-w-0 text-right">
        <p className="font-semibold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(row.totalAmount))}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400">
          発行 {formatDate(row.issueDate)}
        </p>
      </div>
      <DocumentListActions
        detailHref={`${basePath}/${row.id}`}
        editHref={`${basePath}/${row.id}/edit`}
        className="justify-self-end"
      />
    </article>
  );
}

function CommercialDocumentCard({
  row,
  basePath,
}: {
  row: CommercialListRow;
  basePath: string;
}) {
  return (
    <article className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`${basePath}/${row.id}`}
            className="text-lg font-semibold text-zinc-900 hover:underline"
          >
            {row.documentNumber}
          </Link>
          <p className="mt-1 truncate text-sm text-zinc-600">{row.projectName}</p>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {formatContactWithSama(row.customerName)}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            発行 {formatDate(row.issueDate)}
          </p>
        </div>
        <p className="shrink-0 font-semibold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(row.totalAmount))}
        </p>
      </div>
      <div className="mt-4 flex justify-end">
        <DocumentListActions
          detailHref={`${basePath}/${row.id}`}
          editHref={`${basePath}/${row.id}/edit`}
        />
      </div>
    </article>
  );
}

export function CommercialDocumentList({
  kind,
  items,
  emptyTitle,
  emptyDescription,
}: {
  kind: "order" | "delivery_note" | "receipt";
  items: CommercialListRow[];
  emptyTitle: string;
  emptyDescription: string;
}) {
  const labels = getDocumentLabels(kind);
  const basePath = basePathForKind(kind);

  const config = sortConfigForKind(kind);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useListSort<
    OrderSortKey | DeliveryNoteSortKey | ReceiptSortKey
  >(config.listId, config.defaultSort, config.keys);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = q
      ? items.filter(
          (row) =>
            row.documentNumber.toLowerCase().includes(q) ||
            row.projectName.toLowerCase().includes(q) ||
            row.customerName.toLowerCase().includes(q)
        )
      : items;
    return sortCommercialDocuments(matched, sort);
  }, [items, search, sort]);

  return (
    <ListPageContainer>
      <PageHeader title={labels.title} description={`${items.length}件`} />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={`${labels.numberLabel}・案件名・顧客名で検索...`}
        yearFilter="all"
        yearOptions={[{ value: "all", label: "すべて" }]}
        onYearFilterChange={() => {}}
        sort={sort}
        sortOptions={config.options}
        onSortChange={setSort}
        showYearFilter={false}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={search ? "該当する書類が見つかりません" : emptyTitle}
          description={
            search ? "検索条件を変えてお試しください" : emptyDescription
          }
        />
      ) : (
        <>
          <div className={cn(listTableHeaderClass, commercialListGridClass, "px-4")}>
            <span>{labels.numberLabel} / 案件</span>
            <span className="text-right">合計</span>
            <span className="text-right">操作</span>
          </div>
          <div className={listTableBodyClass}>
            {filtered.map((row) => (
              <CommercialDocumentRow key={row.id} row={row} basePath={basePath} />
            ))}
          </div>
          <div className={listCardsClass}>
            {filtered.map((row) => (
              <CommercialDocumentCard key={row.id} row={row} basePath={basePath} />
            ))}
          </div>
        </>
      )}
    </ListPageContainer>
  );
}
