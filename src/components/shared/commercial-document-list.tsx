"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ListToolbar } from "@/components/common/list-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPageContainer } from "@/components/shared/document-list-row";
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
  const basePath =
    kind === "order"
      ? "/orders"
      : kind === "delivery_note"
        ? "/delivery-notes"
        : "/receipts";

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
        <div className="space-y-2">
          {filtered.map((row) => (
            <Link
              key={row.id}
              href={`${basePath}/${row.id}`}
              className="block rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900">{row.documentNumber}</p>
                  <p className="mt-1 truncate text-sm text-zinc-600">
                    {row.projectName}
                  </p>
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
            </Link>
          ))}
        </div>
      )}
    </ListPageContainer>
  );
}
