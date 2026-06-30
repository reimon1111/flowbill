"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
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
  getPaymentListYearDate,
  PAYMENT_SORT_DEFAULT,
  PAYMENT_SORT_KEYS,
  PAYMENT_SORT_OPTIONS,
  sortPayments,
  type PaymentSortKey,
} from "@/lib/list-sorts";
import { useListSort } from "@/hooks/use-list-sort";
import { useListPage } from "@/hooks/use-list-page";
import { EmptyState } from "@/components/shared/empty-state";
import { ActionConfirmDialog } from "@/components/shared/action-confirm-dialog";
import { PaymentStatusBadge } from "@/components/payments/payment-status-badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PaymentDisplayStatus } from "@/lib/payment-utils";
import type { PaymentListItem } from "@/lib/payment-utils";
import { markInvoicePaid } from "@/lib/services/payments";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { enrichPaymentListItem } from "@/lib/payment-utils";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useProjectStore } from "@/stores/project-store";

type PaymentFilter = "all" | PaymentDisplayStatus;

const FILTERS: Array<{ value: PaymentFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "unpaid", label: "未入金" },
  { value: "overdue", label: "期限超過" },
  { value: "paid", label: "入金済" },
];

export function PaymentList() {
  const canWrite = useCanWriteBusinessData();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>(() => {
    const q = searchParams.get("filter");
    if (q === "unpaid" || q === "overdue" || q === "paid") return q;
    return "all";
  });
  const [yearFilter, setYearFilter] = useState<YearFilterValue>("all");
  const [sort, setSort] = useListSort<PaymentSortKey>(
    "payments",
    PAYMENT_SORT_DEFAULT,
    PAYMENT_SORT_KEYS
  );
  const { page, setPage } = useListPage(search, filter, yearFilter, sort);
  const [confirmTarget, setConfirmTarget] = useState<PaymentListItem | null>(null);
  const [loading, setLoading] = useState(false);

  const invoices = useInvoiceStore((s) => s.invoices);
  const projects = useProjectStore((s) => s.projects);
  const customers = useCustomerStore((s) => s.customers);

  const listItems = useMemo(() => {
    return useInvoiceStore
      .getState()
      .getListItems()
      .map(enrichPaymentListItem)
      .filter((x): x is PaymentListItem => x !== null);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- store更新のトリガー用
  }, [invoices, projects, customers]);

  const yearOptions = useMemo(
    () =>
      buildYearFilterOptions(
        collectYearsFromDates(listItems.map((item) => getPaymentListYearDate(item)))
      ),
    [listItems]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = listItems.filter((inv) => {
      if (filter !== "all" && inv.paymentStatus !== filter) return false;
      if (!matchesYearFilter(getPaymentListYearDate(inv), yearFilter)) return false;
      if (!q) return true;
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.projectName.toLowerCase().includes(q) ||
        inv.customerName.toLowerCase().includes(q)
      );
    });
    return sortPayments(items, sort);
  }, [listItems, search, filter, yearFilter, sort]);

  const paged = useMemo(
    () => paginateList(filtered, page),
    [filtered, page]
  );

  const overdueCount = listItems.filter((i) => i.paymentStatus === "overdue").length;
  const unpaidCount = listItems.filter(
    (i) => i.paymentStatus === "unpaid" || i.paymentStatus === "overdue"
  ).length;

  async function handleMarkPaid() {
    if (!confirmTarget) return;
    setLoading(true);
    try {
      const updated = await markInvoicePaid(confirmTarget.id);
      if (updated) {
        toast.success("入金済みにしました");
        setConfirmTarget(null);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="入金管理"
        description="まだ入金されていない請求を、ひと目で把握できます"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryPill
          label="未入金"
          value={`${unpaidCount}件`}
          variant={unpaidCount > 0 ? "warning" : "default"}
        />
        <SummaryPill
          label="期限超過"
          value={`${overdueCount}件`}
          variant={overdueCount > 0 ? "danger" : "default"}
        />
        <SummaryPill
          label="入金済"
          value={`${listItems.filter((i) => i.paymentStatus === "paid").length}件`}
        />
      </div>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="請求書番号・顧客名・案件名で検索..."
        yearFilter={yearFilter}
        yearOptions={yearOptions}
        onYearFilterChange={setYearFilter}
        sort={sort}
        sortOptions={PAYMENT_SORT_OPTIONS}
        onSortChange={setSort}
        statusFilters={FILTERS.map((f) => (
          <ListFilterChip
            key={f.value}
            active={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={
              filter === f.value && f.value === "overdue"
                ? "bg-red-600 text-white"
                : undefined
            }
          >
            {f.label}
            {f.value === "overdue" && overdueCount > 0 && (
              <span className="ml-1.5 rounded-md bg-red-500/20 px-1.5 py-0.5 text-xs">
                {overdueCount}
              </span>
            )}
          </ListFilterChip>
        ))}
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={
            search || filter !== "all" || yearFilter !== "all"
              ? "該当する請求が見つかりません"
              : "入金待ちの請求はありません"
          }
          description={
            search || filter !== "all" || yearFilter !== "all"
              ? "検索・絞り込み条件を変えてお試しください"
              : "発行済み・送付済みの請求書がここに表示されます"
          }
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden lg:grid grid-cols-[140px_minmax(140px,1fr)_minmax(140px,1fr)_120px_110px_100px_100px_auto] gap-4 px-5 text-xs font-medium uppercase tracking-wider text-zinc-400">
            <span>請求書番号</span>
            <span>顧客名</span>
            <span>案件名</span>
            <span className="text-right">請求金額</span>
            <span>支払期限</span>
            <span>ステータス</span>
            <span>期限</span>
            <span />
          </div>
          {paged.items.map((inv) => (
            <PaymentRow
              key={inv.id}
              item={inv}
              canWrite={canWrite}
              onMarkPaid={() => setConfirmTarget(inv)}
            />
          ))}
          <ListPagination
            page={paged.page}
            totalPages={paged.totalPages}
            totalCount={paged.totalCount}
            onPageChange={setPage}
          />
        </div>
      )}

      <ActionConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="入金済みにしますか？"
        description={
          confirmTarget
            ? `${confirmTarget.customerName} — ${confirmTarget.invoiceNumber}（${formatCurrency(Math.round(confirmTarget.totalAmount))}）を入金済みにします。案件の入金状態も更新されます。`
            : ""
        }
        confirmLabel="入金済みにする"
        onConfirm={handleMarkPaid}
        loading={loading}
      />
    </div>
  );
}

function SummaryPill({
  label,
  value,
  variant = "default",
}: {
  label: string;
  value: string;
  variant?: "default" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-5 py-4",
        variant === "danger" &&
          "border-red-200/80 bg-red-50/40 shadow-sm shadow-red-900/[0.03]",
        variant === "warning" &&
          "border-amber-200/80 bg-amber-50/30 shadow-sm shadow-amber-900/[0.02]",
        variant === "default" && "border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.02]"
      )}
    >
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          variant === "danger" && "text-red-700",
          variant === "warning" && "text-amber-800",
          variant === "default" && "text-zinc-900"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function PaymentRow({
  item,
  canWrite,
  onMarkPaid,
}: {
  item: PaymentListItem;
  canWrite: boolean;
  onMarkPaid: () => void;
}) {
  const isOverdue = item.paymentStatus === "overdue";
  const canMarkPaid = item.paymentStatus === "unpaid" || item.paymentStatus === "overdue";
  const rowClass = cn(
    "rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
    isOverdue
      ? "border-red-200/90 bg-red-50/20 shadow-red-900/[0.04] ring-1 ring-red-100"
      : "border-zinc-200/80 shadow-zinc-900/[0.02] hover:shadow-zinc-900/[0.04]"
  );

  const markPaidButton =
    canWrite && canMarkPaid ? (
      <button
        type="button"
        onClick={onMarkPaid}
        className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:w-auto"
      >
        入金済みにする
      </button>
    ) : (
    <Link
      href={`/invoices/${item.id}`}
      className="inline-flex rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
    >
      詳細
    </Link>
  );

  return (
    <>
      <article
        className={cn(
          "hidden items-center gap-4 px-5 py-4 lg:grid lg:grid-cols-[140px_minmax(140px,1fr)_minmax(140px,1fr)_120px_110px_100px_100px_auto]",
          rowClass
        )}
      >
        <Link
          href={`/invoices/${item.id}`}
          className={cn(
            "font-medium hover:underline",
            isOverdue ? "text-red-900" : "text-zinc-900"
          )}
        >
          {item.invoiceNumber}
        </Link>
        <p className="truncate text-sm font-medium text-zinc-800">{item.customerName}</p>
        <p className="truncate text-sm text-zinc-600">{item.projectName}</p>
        <p className="text-right text-base font-semibold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(item.totalAmount))}
        </p>
        <p
          className={cn(
            "text-sm tabular-nums",
            isOverdue ? "font-semibold text-red-700" : "text-zinc-600"
          )}
        >
          {formatDate(item.dueDate)}
        </p>
        <PaymentStatusBadge status={item.paymentStatus} />
        <p
          className={cn(
            "text-sm font-medium tabular-nums",
            isOverdue ? "text-red-700" : item.daysUntilDue <= 3 ? "text-amber-700" : "text-zinc-500"
          )}
        >
          {item.daysLabel}
        </p>
        <div className="flex justify-end">{markPaidButton}</div>
      </article>

      <article className={cn("space-y-3 p-4 lg:hidden", rowClass)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/invoices/${item.id}`}
              className={cn(
                "font-semibold hover:underline",
                isOverdue ? "text-red-900" : "text-zinc-900"
              )}
            >
              {item.invoiceNumber}
            </Link>
            <p className="mt-1 truncate text-sm font-medium text-zinc-800">{item.customerName}</p>
            <p className="truncate text-sm text-zinc-500">{item.projectName}</p>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums text-zinc-900">
            {formatCurrency(Math.round(item.totalAmount))}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PaymentStatusBadge status={item.paymentStatus} />
          <span
            className={cn(
              "text-sm font-medium tabular-nums",
              isOverdue ? "text-red-700" : "text-zinc-500"
            )}
          >
            期限 {formatDate(item.dueDate)} · {item.daysLabel}
          </span>
        </div>
        {markPaidButton}
      </article>
    </>
  );
}
