"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatSupabaseError, PAYMENT_STATUS_UPDATE_FAILED_MESSAGE } from "@/lib/db/errors";
import { getOrderCreationToastMessage } from "@/lib/order-creation-error";
import { TodayDescription } from "@/components/shared/today-description";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatShortDate } from "@/lib/format";
import { getWeeklyScheduleProjects } from "@/lib/project-schedule-utils";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import { getDashboardStats } from "@/lib/services/projects";
import {
  getPaymentDashboardStats,
} from "@/lib/services/payments";
import { enrichPaymentListItem } from "@/lib/payment-utils";
import { getProjectInvoiceState } from "@/lib/invoice-state";
import { BILLING_STATUS_THEME } from "@/lib/billing-status-theme";
import { getProjectTotalWithTax } from "@/lib/project-amount-display";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useProjectStore } from "@/stores/project-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import {
  completeWorkForProject,
  confirmOrderForProject,
  resolveProjectInvoiceHref,
  markProjectPaid,
} from "@/lib/services/projects";
import { ActivityLogFeed } from "@/components/shared/activity-log-panel";
import { useActivityLogStore } from "@/stores/activity-log-store";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

type TaskTone = "overdue" | "unpaid" | "unissued" | "work" | "order";

type DashboardTask = {
  key: string;
  tone: TaskTone;
  categoryLabel: string;
  projectName: string;
  customerName: string;
  amount: number;
  dateLabel: string;
  buttonLabel: string;
  busyKey: string;
  href: string;
  projectId: string;
  invoiceId?: string;
  action: "paid" | "issue" | "complete" | "order";
};

const TONE_STYLES: Record<
  TaskTone,
  { card: string; badge: string; button: string; kpi: string; kpiText: string }
> = {
  overdue: {
    card: BILLING_STATUS_THEME.overdue.cardClass,
    badge: BILLING_STATUS_THEME.overdue.badgeClass,
    button: BILLING_STATUS_THEME.overdue.buttonClass,
    kpi: BILLING_STATUS_THEME.overdue.kpiClass,
    kpiText: BILLING_STATUS_THEME.overdue.kpiTextClass,
  },
  unpaid: {
    card: BILLING_STATUS_THEME.unpaid.cardClass,
    badge: BILLING_STATUS_THEME.unpaid.badgeClass,
    button: BILLING_STATUS_THEME.unpaid.buttonClass,
    kpi: BILLING_STATUS_THEME.unpaid.kpiClass,
    kpiText: BILLING_STATUS_THEME.unpaid.kpiTextClass,
  },
  unissued: {
    card: BILLING_STATUS_THEME.unissued.cardClass,
    badge: BILLING_STATUS_THEME.unissued.badgeClass,
    button: BILLING_STATUS_THEME.unissued.buttonClass,
    kpi: BILLING_STATUS_THEME.unissued.kpiClass,
    kpiText: BILLING_STATUS_THEME.unissued.kpiTextClass,
  },
  work: {
    card: "border-emerald-200/80 bg-emerald-50/40",
    badge: "inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700",
    button: "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    kpi: "border-emerald-200/70 bg-emerald-50/50",
    kpiText: "text-emerald-800",
  },
  order: {
    card: "border-violet-200/80 bg-violet-50/40",
    badge: "inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700",
    button: "border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    kpi: "border-violet-200/70 bg-violet-50/50",
    kpiText: "text-violet-800",
  },
};

export function DashboardPage() {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  useProjectStore((s) => s.projects);
  useCustomerStore((s) => s.customers);
  useInvoiceStore((s) => s.invoices);
  const projectItems = useProjectItemStore((s) => s.projectItems);
  const recentActivityLogs = useActivityLogStore((s) => s.recentLogs);

  const stats = getDashboardStats();
  const paymentStats = getPaymentDashboardStats();

  const projects = useProjectStore
    .getState()
    .getListItems()
    .filter((p) => !p.archived);
  const invoices = useInvoiceStore.getState().getListItems();
  const billableInvoices = useInvoiceStore.getState().getInvoices();

  const projectAmountWithTax = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of projects) {
      map.set(
        p.id,
        getProjectTotalWithTax(p.id, p.amount, projectItems, p)
      );
    }
    return map;
  }, [projects, projectItems]);

  const sumProjectAmounts = (items: typeof projects) =>
    items.reduce((s, p) => s + (projectAmountWithTax.get(p.id) ?? p.amount), 0);

  const overdueItems = useMemo(() => {
    return paymentStats.overdueItems
      .map((x) => {
        const inv = invoices.find((i) => i.id === x.invoiceId);
        if (!inv) return null;
        return { ...x, invoice: inv };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [paymentStats.overdueItems, invoices]);

  const unpaidItems = useMemo(
    () =>
      projects
        .filter((p) => {
          if (p.status !== "completed") return false;
          const state = getProjectInvoiceState(p.id, billableInvoices);
          return (
            (state.invoiceStatus === "issued" || state.invoiceStatus === "sent") &&
            state.paymentStatus === "unpaid"
          );
        })
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [projects, billableInvoices]
  );

  const unissuedItems = useMemo(
    () =>
      projects
        .filter((p) => {
          if (p.status !== "completed") return false;
          const state = getProjectInvoiceState(p.id, billableInvoices);
          return (
            state.invoiceStatus === "not_created" || state.invoiceStatus === "draft"
          );
        })
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects, billableInvoices]
  );

  const workPendingItems = useMemo(
    () =>
      projects
        .filter((p) => p.status === "ordered" || p.status === "in_progress")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  );

  const orderPendingItems = useMemo(
    () =>
      projects
        .filter((p) => p.status === "estimate")
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [projects]
  );

  const weeklyScheduleProjects = useMemo(
    () => getWeeklyScheduleProjects(projects),
    [projects]
  );

  const upcomingPayments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + 30);

    return invoices
      .map(enrichPaymentListItem)
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => x.paymentStatus === "unpaid")
      .filter((x) => {
        const due = new Date(x.dueDate + "T00:00:00");
        return due >= today && due <= limit;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 12);
  }, [invoices]);

  const summary = useMemo(() => {
    const billed = stats.billedThisMonth;
    const paid = paymentStats.paidThisMonthAmount;
    const unpaidTotal = invoices
      .map(enrichPaymentListItem)
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .filter((x) => x.paymentStatus === "unpaid" || x.paymentStatus === "overdue")
      .reduce((s, x) => s + x.totalAmount, 0);
    const collectionRate = billed > 0 ? Math.round((paid / billed) * 100) : 0;
    return { billed, paid, unpaidTotal, collectionRate };
  }, [stats.billedThisMonth, paymentStats.paidThisMonthAmount, invoices]);

  const kpiCards = useMemo(
    () => [
      {
        tone: "overdue" as const,
        label: "期限超過",
        count: paymentStats.overdueCount,
        amount: overdueItems.reduce((s, x) => s + x.totalAmount, 0),
        hint: "今すぐ対応が必要です",
      },
      {
        tone: "unpaid" as const,
        label: "未入金",
        count: unpaidItems.length,
        amount: sumProjectAmounts(unpaidItems),
        hint: "入金確認が必要です",
      },
      {
        tone: "unissued" as const,
        label: "請求書未発行",
        count: unissuedItems.length,
        amount: sumProjectAmounts(unissuedItems),
        hint: "請求書を発行できます",
      },
      {
        tone: "work" as const,
        label: "作業完了待ち",
        count: workPendingItems.length,
        amount: sumProjectAmounts(workPendingItems),
        hint: "作業完了にできます",
      },
      {
        tone: "order" as const,
        label: "受注待ち",
        count: orderPendingItems.length,
        amount: sumProjectAmounts(orderPendingItems),
        hint: "受注確認が必要です",
      },
      {
        tone: "revenue" as const,
        label: "今月売上",
        count: null as number | null,
        amount: stats.paidThisMonth,
        hint: "今月の入金済み売上",
      },
    ],
    [
      paymentStats.overdueCount,
      overdueItems,
      unpaidItems,
      unissuedItems,
      workPendingItems,
      orderPendingItems,
      stats.paidThisMonth,
      projectAmountWithTax,
    ]
  );

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const handleMarkPaid = async (projectId: string, invoiceId?: string) => {
    try {
      setBusyKey(`paid:${invoiceId ?? projectId}`);
      const updated = await markProjectPaid(projectId);
      if (!updated) {
        toast.error(PAYMENT_STATUS_UPDATE_FAILED_MESSAGE);
        return;
      }
      toast.success("入金済みにしました");
    } catch (error) {
      toast.error(
        error instanceof Error &&
          error.message !== PAYMENT_STATUS_UPDATE_FAILED_MESSAGE
          ? error.message
          : PAYMENT_STATUS_UPDATE_FAILED_MESSAGE,
        {
          description:
            process.env.NODE_ENV === "development"
              ? formatSupabaseError(error)
              : undefined,
        }
      );
    } finally {
      setBusyKey(null);
    }
  };

  const handleIssueInvoice = async (projectId: string) => {
    try {
      setBusyKey(`issue:${projectId}`);
      router.push(resolveProjectInvoiceHref(projectId));
    } finally {
      setBusyKey(null);
    }
  };

  const handleCompleteWork = async (projectId: string) => {
    try {
      setBusyKey(`complete:${projectId}`);
      await completeWorkForProject(projectId);
      toast.success("作業を完了しました");
    } catch (error) {
      toast.error("操作に失敗しました", {
        description: formatSupabaseError(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const handleConfirmOrder = async (projectId: string) => {
    try {
      setBusyKey(`order:${projectId}`);
      const result = await confirmOrderForProject(projectId);
      if (result?.orderAlreadyExisted) {
        toast.message("注文書はすでに作成済みです");
        toast.success("受注を確定しました");
        return;
      }
      toast.success("受注確定し、注文書を作成しました", {
        description: result?.order?.orderNumber,
      });
    } catch (error) {
      console.error("confirm order error", { projectId, error });
      const message = getOrderCreationToastMessage(error);
      toast.error(message ?? "注文書の作成に失敗しました", {
        description: message ? undefined : formatSupabaseError(error),
      });
    } finally {
      setBusyKey(null);
    }
  };

  const todayTasks = useMemo((): DashboardTask[] => {
    const tasks: DashboardTask[] = [];

    for (const x of overdueItems) {
      tasks.push({
        key: `overdue:${x.invoiceId}`,
        tone: "overdue",
        categoryLabel: "期限超過",
        projectName: x.projectName,
        customerName: x.customerName,
        amount: x.totalAmount,
        dateLabel: `期限 ${formatShortDate(x.invoice.dueDate)}`,
        buttonLabel: "入金済みにする",
        busyKey: `paid:${x.invoiceId}`,
        href: `/invoices/${x.invoiceId}`,
        projectId: x.invoice.projectId,
        invoiceId: x.invoiceId,
        action: "paid",
      });
    }

    for (const p of unpaidItems) {
      tasks.push({
        key: `unpaid:${p.id}`,
        tone: "unpaid",
        categoryLabel: "未入金",
        projectName: p.projectName,
        customerName: p.customerName,
        amount: projectAmountWithTax.get(p.id) ?? p.amount,
        dateLabel: p.dueDate ? `期限 ${formatShortDate(p.dueDate)}` : "期限 —",
        buttonLabel: "入金済みにする",
        busyKey: `paid:${p.id}`,
        href: `/projects/${p.id}`,
        projectId: p.id,
        action: "paid",
      });
    }

    for (const p of unissuedItems) {
      tasks.push({
        key: `unissued:${p.id}`,
        tone: "unissued",
        categoryLabel: "請求書未発行",
        projectName: p.projectName,
        customerName: p.customerName,
        amount: projectAmountWithTax.get(p.id) ?? p.amount,
        dateLabel: p.dueDate ? `納期 ${formatShortDate(p.dueDate)}` : "納期 —",
        buttonLabel: BILLING_STATUS_THEME.unissued.actionLabel,
        busyKey: `issue:${p.id}`,
        href: `/projects/${p.id}`,
        projectId: p.id,
        action: "issue",
      });
    }

    for (const p of workPendingItems) {
      tasks.push({
        key: `work:${p.id}`,
        tone: "work",
        categoryLabel: "作業完了待ち",
        projectName: p.projectName,
        customerName: p.customerName,
        amount: projectAmountWithTax.get(p.id) ?? p.amount,
        dateLabel: p.dueDate ? `納期 ${formatShortDate(p.dueDate)}` : "納期 —",
        buttonLabel: "作業完了にする",
        busyKey: `complete:${p.id}`,
        href: `/projects/${p.id}`,
        projectId: p.id,
        action: "complete",
      });
    }

    for (const p of orderPendingItems) {
      tasks.push({
        key: `order:${p.id}`,
        tone: "order",
        categoryLabel: "受注待ち",
        projectName: p.projectName,
        customerName: p.customerName,
        amount: projectAmountWithTax.get(p.id) ?? p.amount,
        dateLabel: p.dueDate ? `納期 ${formatShortDate(p.dueDate)}` : "納期 —",
        buttonLabel: "受注確定する",
        busyKey: `order:${p.id}`,
        href: `/projects/${p.id}`,
        projectId: p.id,
        action: "order",
      });
    }

    return tasks;
  }, [overdueItems, unpaidItems, unissuedItems, workPendingItems, orderPendingItems, projectAmountWithTax]);

  const runTaskAction = async (task: DashboardTask) => {
    switch (task.action) {
      case "paid":
        await handleMarkPaid(task.projectId, task.invoiceId);
        break;
      case "issue":
        await handleIssueInvoice(task.projectId);
        break;
      case "complete":
        await handleCompleteWork(task.projectId);
        break;
      case "order":
        await handleConfirmOrder(task.projectId);
        break;
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-[1400px] space-y-6 px-5 py-6 lg:px-8 lg:py-8">
      {/* ① ヘッダー */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 lg:text-3xl">
          おはようございます！
        </h1>
        <TodayDescription className="text-sm text-zinc-500 lg:text-base" />
      </header>

      {/* ② KPI */}
      <section className="-mx-5 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0">
        <div className="flex min-w-max gap-3 lg:min-w-0 lg:grid lg:grid-cols-6">
          {kpiCards.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </section>

      {/* ③ 今日やること */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">今日やること</h2>
            <p className="text-sm text-zinc-500">優先順 — 上から順に対応してください</p>
          </div>
          <Link
            href="/projects"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-zinc-600")}
          >
            案件一覧
          </Link>
        </div>

        {todayTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-10 text-center">
            <p className="font-medium text-zinc-900">今日の要対応はありません</p>
            <p className="mt-1 text-sm text-zinc-500">新しい案件や見積から始められます</p>
            {canWrite ? (
              <Link
                href="/projects/new"
                className={cn(
                  buttonVariants(),
                  "mt-4 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                案件を作成
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 lg:mx-0 lg:px-0">
            {todayTasks.map((task) => (
              <TaskCard
                key={task.key}
                task={task}
                busy={busyKey === task.busyKey}
                canWrite={canWrite}
                onAction={() => runTaskAction(task)}
              />
            ))}
          </div>
        )}
      </section>

      {/* 操作履歴 */}
      <section className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02] lg:p-6">
        <h2 className="text-lg font-semibold text-zinc-900">最近の操作</h2>
        <p className="mt-1 text-sm text-zinc-500">会社内の最新10件</p>
        <div className="mt-4">
          <ActivityLogFeed logs={recentActivityLogs} />
        </div>
      </section>

      {/* ④ 今週の予定 */}
      <WeeklyScheduleSection projects={weeklyScheduleProjects} />

      {/* ⑤ 下段 2カラム */}
      <section className="grid gap-4 lg:grid-cols-2">
        <RevenueSummary summary={summary} billedThisMonth={stats.billedThisMonth} />
        <UpcomingPayments items={upcomingPayments} />
      </section>
    </div>
  );
}

function KpiCard({
  tone,
  label,
  count,
  amount,
  hint,
}: {
  tone: TaskTone | "revenue";
  label: string;
  count: number | null;
  amount: number;
  hint: string;
}) {
  const styles =
    tone === "revenue"
      ? {
          kpi: "border-sky-200/70 bg-sky-50/50",
          kpiText: "text-sky-900",
        }
      : TONE_STYLES[tone];

  return (
    <div
      className={cn(
        "w-[148px] shrink-0 rounded-xl border p-4 lg:w-auto",
        styles.kpi
      )}
    >
      <p className={cn("text-xs font-semibold", styles.kpiText)}>{label}</p>
      {count !== null && (
        <p className={cn("mt-2 text-2xl font-bold tabular-nums leading-none", styles.kpiText)}>
          {count}件
        </p>
      )}
      <p
        className={cn(
          "mt-2 text-lg font-bold tabular-nums leading-tight",
          styles.kpiText,
          count === null && "mt-3 text-2xl"
        )}
      >
        {formatCurrency(Math.round(amount))}
      </p>
      <p className="mt-2 text-[11px] leading-snug text-zinc-600">{hint}</p>
    </div>
  );
}

function TaskCard({
  task,
  busy,
  canWrite,
  onAction,
}: {
  task: DashboardTask;
  busy: boolean;
  canWrite: boolean;
  onAction: () => void | Promise<void>;
}) {
  const styles = TONE_STYLES[task.tone];

  return (
    <article
      className={cn(
        "flex w-[280px] shrink-0 flex-col rounded-xl border p-4 shadow-sm shadow-zinc-900/[0.03]",
        styles.card
      )}
    >
      <span className={cn("inline-flex w-fit text-xs font-semibold", styles.badge)}>
        {task.categoryLabel}
      </span>

      <Link href={task.href} className="mt-3 min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-zinc-900">{task.projectName}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-600">{task.customerName}</p>
      </Link>

      <div className="mt-4 flex items-end justify-between gap-2">
        <p className="text-xl font-bold tabular-nums text-zinc-900">
          {formatCurrency(Math.round(task.amount))}
        </p>
        <p className="text-xs font-medium text-zinc-500">{task.dateLabel}</p>
      </div>

      {canWrite ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onAction()}
          className={cn(
            "mt-4 w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
            styles.button,
            busy && "opacity-70"
          )}
        >
          {busy ? "処理中..." : task.buttonLabel}
        </button>
      ) : null}
    </article>
  );
}

function RevenueSummary({
  summary,
  billedThisMonth,
}: {
  summary: {
    billed: number;
    paid: number;
    unpaidTotal: number;
    collectionRate: number;
  };
  billedThisMonth: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <h2 className="text-base font-semibold text-zinc-900">売上・入金サマリー</h2>
      <p className="mt-0.5 text-xs text-zinc-500">今月の請求・入金状況</p>

      <dl className="mt-5 space-y-4">
        <SummaryRow label="請求額（今月）" value={billedThisMonth} />
        <SummaryRow label="入金済額（今月）" value={summary.paid} accent="text-emerald-700" />
        <SummaryRow label="未入金額（全体）" value={summary.unpaidTotal} accent="text-amber-700" />
      </dl>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-700">回収率（今月）</span>
          <span className="font-bold tabular-nums text-zinc-900">{summary.collectionRate}%</span>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${Math.min(summary.collectionRate, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-zinc-600">{label}</dt>
      <dd className={cn("text-lg font-bold tabular-nums text-zinc-900", accent)}>
        {formatCurrency(Math.round(value))}
      </dd>
    </div>
  );
}

function UpcomingPayments({
  items,
}: {
  items: Array<{
    id: string;
    dueDate: string;
    customerName: string;
    projectName: string;
    totalAmount: number;
    daysLabel: string;
    paymentStatus: string;
  }>;
}) {
  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">入金予定（今後30日）</h2>
          <p className="mt-0.5 text-xs text-zinc-500">未入金の請求書</p>
        </div>
        <Link
          href="/payments"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-zinc-600")}
        >
          入金管理
        </Link>
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-center text-sm text-zinc-500">30日以内の入金予定はありません</p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/invoices/${item.id}`}
                className="flex items-center gap-3 py-3 transition-colors hover:bg-zinc-50/80"
              >
                <div className="w-14 shrink-0 text-xs font-medium tabular-nums text-zinc-500">
                  {formatShortDate(item.dueDate)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900">{item.customerName}</p>
                  <p className="truncate text-xs text-zinc-500">{item.projectName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-zinc-900">
                    {formatCurrency(Math.round(item.totalAmount))}
                  </p>
                  <p className="text-[11px] text-zinc-500">{item.daysLabel}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function WeeklyScheduleSection({
  projects,
}: {
  projects: ReturnType<typeof getWeeklyScheduleProjects>;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">今週の予定</h2>
          <p className="text-sm text-zinc-500">開始日〜完了予定日が今週にかかる案件</p>
        </div>
        <Link
          href="/projects/schedule"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "shrink-0 text-zinc-600")}
        >
          予定表を見る
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 bg-white px-6 py-8 text-center">
          <p className="text-sm text-zinc-500">今週の予定はありません</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200/80 bg-white">
          <ul className="divide-y divide-zinc-100">
            {projects.slice(0, 6).map((project) => (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-zinc-50/80"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {project.projectName}
                    </p>
                    <p className="truncate text-xs text-zinc-500">{project.customerName}</p>
                  </div>
                  <p className="text-xs tabular-nums text-zinc-600">
                    {formatDate(project.startDate)} — {formatDate(project.endDate)}
                  </p>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700">
                    {PROJECT_STATUS_LABELS[project.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
