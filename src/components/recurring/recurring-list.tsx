"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Pause, Play, Plus, Square } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { ActionConfirmDialog } from "@/components/shared/action-confirm-dialog";
import { RecurringStatusBadge } from "@/components/recurring/recurring-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import { daysUntil, formatNextBillingLabel } from "@/lib/recurring-utils";
import type { RecurringBillingListItem, RecurringBillingStatus } from "@/lib/types";
import {
  createInvoiceFromRecurring,
  updateRecurringStatus,
} from "@/lib/services/recurring";
import { useRecurringStore } from "@/stores/recurring-store";
import { useCustomerStore } from "@/stores/customer-store";

type StatusFilter = RecurringBillingStatus | "all";

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "active", label: "有効" },
  { value: "paused", label: "停止中" },
  { value: "ended", label: "終了" },
];

export function RecurringList() {
  const router = useRouter();
  useRecurringStore((s) => s.recurringBillings);
  useCustomerStore((s) => s.customers);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [confirmGenerate, setConfirmGenerate] = useState<RecurringBillingListItem | null>(
    null
  );

  const listItems = useRecurringStore.getState().getListItems();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listItems
      .filter((r) => {
        if (status !== "all" && r.status !== status) return false;
        if (!q) return true;
        return (
          r.title.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (a.status === "active" && b.status !== "active") return -1;
        if (b.status === "active" && a.status !== "active") return 1;
        return a.nextBillingDate.localeCompare(b.nextBillingDate);
      });
  }, [listItems, search, status]);

  const activeCount = listItems.filter((r) => r.status === "active").length;

  async function handleGenerate() {
    if (!confirmGenerate) return;
    setGeneratingId(confirmGenerate.id);
    try {
      const result = await createInvoiceFromRecurring(confirmGenerate.id);
      if (result) {
        toast.success("請求書を生成しました", {
          description: result.invoice.invoiceNumber,
        });
        setConfirmGenerate(null);
        router.push(`/invoices/${result.invoice.id}`);
      } else {
        toast.error("請求書を生成できませんでした");
      }
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleStatusChange(
    id: string,
    next: RecurringBillingStatus,
    label: string
  ) {
    const updated = await updateRecurringStatus(id, next);
    if (updated) toast.success(label);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
      <PageHeader
        title="定期請求"
        description={`${activeCount}件が有効 — 毎月の請求漏れを防ぎます`}
        action={
          <Link
            href="/recurring-billings/new"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-10 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
            )}
          >
            <Plus className="size-4" />
            新規登録
          </Link>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="タイトル・顧客名で検索..."
          className="max-w-md flex-1"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              "rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              status === f.value
                ? "bg-zinc-900 text-white"
                : "bg-white text-zinc-600 ring-1 ring-zinc-200/80 hover:bg-zinc-50"
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={search || status !== "all" ? "該当する定期請求がありません" : "まだ定期請求がありません"}
          description={
            search || status !== "all"
              ? "検索・絞り込み条件を変えてお試しください"
              : "HP保守費・月額管理費などを登録して、次回請求予定を管理しましょう"
          }
          action={
            !(search || status !== "all") && (
              <Link
                href="/recurring-billings/new"
                className={cn(
                  buttonVariants(),
                  "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                定期請求を登録
              </Link>
            )
          }
        />
      ) : (
        <div className="space-y-2">
          <div className="hidden px-5 text-xs font-medium uppercase tracking-wider text-zinc-400 lg:grid lg:grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_120px_120px_100px_auto] lg:gap-4">
            <span>タイトル</span>
            <span>顧客名</span>
            <span className="text-right">金額</span>
            <span>次回請求日</span>
            <span>状態</span>
            <span />
          </div>
          {filtered.map((item) => (
            <RecurringRow
              key={item.id}
              item={item}
              onGenerate={() => setConfirmGenerate(item)}
              onStatusChange={handleStatusChange}
              generating={generatingId === item.id}
            />
          ))}
        </div>
      )}

      <ActionConfirmDialog
        open={!!confirmGenerate}
        onOpenChange={(open) => !open && setConfirmGenerate(null)}
        title="請求書を生成しますか？"
        description={
          confirmGenerate
            ? `「${confirmGenerate.title}」（${formatCurrency(Math.round(confirmGenerate.totalAmount))}）の請求書を作成します。次回請求予定日も1ヶ月進みます。`
            : ""
        }
        confirmLabel="請求書を生成"
        onConfirm={handleGenerate}
        loading={!!generatingId}
      />
    </div>
  );
}

function RecurringRow({
  item,
  onGenerate,
  onStatusChange,
  generating,
}: {
  item: RecurringBillingListItem;
  onGenerate: () => void;
  onStatusChange: (id: string, status: RecurringBillingStatus, label: string) => void;
  generating: boolean;
}) {
  const isActive = item.status === "active";
  const isDueSoon = isActive && daysUntil(item.nextBillingDate) <= 7;

  const rowClass = cn(
    "rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md",
    isDueSoon && isActive
      ? "border-violet-200/90 bg-violet-50/20 ring-1 ring-violet-100"
      : "border-zinc-200/80 shadow-zinc-900/[0.02] hover:shadow-zinc-900/[0.04]"
  );

  return (
    <>
      <article
        className={cn(
          "hidden items-center gap-4 px-5 py-4 lg:grid lg:grid-cols-[minmax(160px,1.2fr)_minmax(140px,1fr)_120px_120px_100px_auto]",
          rowClass
        )}
      >
        <div className="min-w-0">
          <p className="truncate font-medium text-zinc-900">{item.title}</p>
          <p className="mt-0.5 text-xs text-zinc-400">毎月{item.billingDay}日</p>
        </div>
        <p className="truncate text-sm text-zinc-600">{item.customerName}</p>
        <p className="text-right text-base font-semibold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(item.totalAmount))}
        </p>
        <div>
          <p className={cn("text-sm tabular-nums", isActive ? "font-medium text-zinc-800" : "text-zinc-400")}>
            {isActive ? formatDate(item.nextBillingDate) : "—"}
          </p>
          {isActive && (
            <p className={cn("text-xs", isDueSoon ? "text-violet-700" : "text-zinc-400")}>
              {formatNextBillingLabel(item.nextBillingDate)}
            </p>
          )}
        </div>
        <RecurringStatusBadge status={item.status} />
        <RowActions
          item={item}
          onGenerate={onGenerate}
          onStatusChange={onStatusChange}
          generating={generating}
        />
      </article>

      <article className={cn("space-y-3 p-4 lg:hidden", rowClass)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-zinc-900">{item.title}</p>
            <p className="text-sm text-zinc-500">{item.customerName}</p>
          </div>
          <p className="shrink-0 text-lg font-semibold tabular-nums">
            {formatCurrency(Math.round(item.totalAmount))}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <RecurringStatusBadge status={item.status} />
          {isActive && (
            <span className={cn("text-sm", isDueSoon ? "font-medium text-violet-700" : "text-zinc-500")}>
              次回 {formatDate(item.nextBillingDate)} · {formatNextBillingLabel(item.nextBillingDate)}
            </span>
          )}
        </div>
        <RowActions
          item={item}
          onGenerate={onGenerate}
          onStatusChange={onStatusChange}
          generating={generating}
          stacked
        />
      </article>
    </>
  );
}

function RowActions({
  item,
  onGenerate,
  onStatusChange,
  generating,
  stacked,
}: {
  item: RecurringBillingListItem;
  onGenerate: () => void;
  onStatusChange: (id: string, status: RecurringBillingStatus, label: string) => void;
  generating: boolean;
  stacked?: boolean;
}) {
  const wrap = stacked ? "flex flex-col gap-2" : "flex flex-wrap justify-end gap-2";

  if (item.status === "ended") {
    return (
      <div className={wrap}>
        <Link
          href={`/recurring-billings/${item.id}/edit`}
          className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          詳細
        </Link>
      </div>
    );
  }

  return (
    <div className={wrap}>
      {item.status === "active" && (
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
        >
          <FileText className="size-3.5" />
          請求書を生成
        </button>
      )}
      <Link
        href={`/recurring-billings/${item.id}/edit`}
        className="rounded-lg border border-zinc-200 px-2.5 py-1.5 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
      >
        編集
      </Link>
      {item.status === "active" && (
        <button
          type="button"
          onClick={() => onStatusChange(item.id, "paused", "定期請求を停止しました")}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-amber-200 px-2.5 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
        >
          <Pause className="size-3.5" />
          停止
        </button>
      )}
      {item.status === "paused" && (
        <button
          type="button"
          onClick={() => onStatusChange(item.id, "active", "定期請求を再開しました")}
          className="inline-flex items-center justify-center gap-1 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
        >
          <Play className="size-3.5" />
          再開
        </button>
      )}
      <button
        type="button"
        onClick={() => onStatusChange(item.id, "ended", "定期請求を終了しました")}
        className="inline-flex items-center justify-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50"
      >
        <Square className="size-3.5" />
        終了
      </button>
    </div>
  );
}
