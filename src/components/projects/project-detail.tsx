"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  ArchiveRestore,
  Building2,
  Calendar,
  FileText,
  MapPin,
  Pencil,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { VIEWER_WRITE_DENIED_MESSAGE } from "@/lib/guards/write-access";
import { cn } from "@/lib/utils";
import type {
  ProjectActionType,
  ProjectHistoryEvent,
  ProjectListItem,
  QuoteRecord,
} from "@/lib/types";
import {
  BillingProjectStatusBadge,
  ProjectStatusBadge,
} from "@/components/projects/project-status-badge";
import { ProjectTimeline } from "@/components/projects/project-timeline";
import { formatCurrency, formatDate } from "@/lib/format";
import { getNextAction, getStatusChangeMessage } from "@/lib/project-utils";
import { ProjectNextStepsPanel } from "@/components/projects/project-next-steps-panel";
import {
  completeWorkForProject,
  confirmOrderForProject,
  deleteProject,
  archiveProject,
  unarchiveProject,
  getProjectDeletionBlockReason,
  resolveProjectInvoiceHref,
  markProjectPaid,
  syncCustomerProjectCounts,
} from "@/lib/services/projects";
import { formatSupabaseError, PAYMENT_STATUS_UPDATE_FAILED_MESSAGE } from "@/lib/db/errors";
import { getOrderCreationToastMessage } from "@/lib/order-creation-error";
import { useProjectStore } from "@/stores/project-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useQuoteStore } from "@/stores/quote-store";
import { ProjectItemsSummary } from "@/components/projects/project-items-summary";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";
import { BillingStatusBadge } from "@/components/billing/billing-status-badge";
import { formatDateTime } from "@/lib/format";
import {
  buildProjectInvoiceHref,
  getProjectInvoiceTabState,
} from "@/lib/project-invoice-actions";
import { getProjectInvoiceState } from "@/lib/invoice-state";
import {
  getBillingStatusTheme,
  getInvoiceBillingDisplayStatus,
  getProjectBillingDisplayStatus,
  getProjectBillingViewHref,
} from "@/lib/billing-status-theme";
import { getProjectTotalWithTax } from "@/lib/project-amount-display";
import {
  createDeliveryNoteFromProject,
  createOrderFromProject,
  createReceiptFromProject,
} from "@/lib/services/commercial-documents";
import {
  isQuoteConfirmedForOrder,
} from "@/lib/order-create-source";
import {
  CreateOrderQuoteSelectDialog,
  CreateOrderUnconfirmedDialog,
} from "@/components/orders/create-order-dialogs";
import { AuditTrailPanel } from "@/components/shared/audit-trail-panel";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";

type ProjectDetailProps = {
  project: ProjectListItem;
  history: ProjectHistoryEvent[];
};

const PROJECT_DETAIL_TABS = [
  "overview",
  "quote",
  "order",
  "delivery",
  "invoice",
  "receipt",
  "history",
] as const;

type ProjectDetailTab = (typeof PROJECT_DETAIL_TABS)[number];

function isProjectDetailTab(value: string | null): value is ProjectDetailTab {
  return PROJECT_DETAIL_TABS.includes(value as ProjectDetailTab);
}

export function ProjectDetail({ project, history }: ProjectDetailProps) {
  const canWrite = useCanWriteBusinessData();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const urlTab = isProjectDetailTab(tabParam) ? tabParam : "overview";

  const liveProject =
    useProjectStore((s) => s.projects.find((p) => p.id === project.id)) ?? project;
  const quotes = useQuoteStore((s) => s.quotes);
  const projectItemsList = useProjectItemStore((s) => s.projectItems);
  const invoicesList = useInvoiceStore((s) => s.invoices);
  const projectInvoiceState = useMemo(
    () => getProjectInvoiceState(liveProject.id, invoicesList),
    [liveProject.id, invoicesList]
  );
  const displayAmount = useMemo(
    () =>
      getProjectTotalWithTax(
        liveProject.id,
        liveProject.amount,
        projectItemsList,
        liveProject
      ),
    [liveProject.id, liveProject.amount, projectItemsList, liveProject.discountAmount, liveProject.discountLabel]
  );
  const billingStatus = useMemo(
    () =>
      getProjectBillingDisplayStatus(projectInvoiceState, liveProject.status),
    [projectInvoiceState, liveProject.status]
  );
  const nextAction = useMemo(
    () =>
      getNextAction({
        status: liveProject.status,
        invoiceStatus: projectInvoiceState.invoiceStatus,
        paymentStatus: projectInvoiceState.paymentStatus,
        hasMultipleActive: projectInvoiceState.hasMultipleActive,
      }),
    [
      liveProject.status,
      projectInvoiceState.invoiceStatus,
      projectInvoiceState.paymentStatus,
      projectInvoiceState.hasMultipleActive,
    ]
  );
  const ordersList = useOrderStore((s) => s.orders);
  const deliveryNotesList = useDeliveryNoteStore((s) => s.deliveryNotes);
  const receiptsList = useReceiptStore((s) => s.receipts);

  const projectItems = useMemo(
    () =>
      projectItemsList
        .filter((i) => i.projectId === liveProject.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [projectItemsList, liveProject.id]
  );

  const latestQuote = useMemo(
    () =>
      quotes
        .filter((q) => q.projectId === liveProject.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [quotes, liveProject.id]
  );
  const latestInvoice = useMemo(
    () =>
      invoicesList
        .filter(
          (inv) =>
            inv.projectId === liveProject.id &&
            !inv.deletedAt &&
            inv.status !== "cancelled"
        )
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [invoicesList, liveProject.id]
  );
  const [showCancelledInvoices, setShowCancelledInvoices] = useState(false);
  const invoiceTabState = useMemo(
    () =>
      getProjectInvoiceTabState({
        invoices: invoicesList,
        projectId: liveProject.id,
        showCancelled: showCancelledInvoices,
      }),
    [invoicesList, liveProject.id, showCancelledInvoices]
  );
  const latestOrder = useMemo(
    () =>
      ordersList
        .filter((o) => o.projectId === liveProject.id && !o.deletedAt)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [ordersList, liveProject.id]
  );
  const latestDeliveryNote = useMemo(
    () =>
      deliveryNotesList
        .filter((d) => d.projectId === liveProject.id && !d.deletedAt)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [deliveryNotesList, liveProject.id]
  );
  const latestReceipt = useMemo(
    () =>
      receiptsList
        .filter((r) => r.projectId === liveProject.id && !r.deletedAt)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [receiptsList, liveProject.id]
  );

  const canCreateOrder = canWrite && liveProject.status !== "lost";
  const canCreateDelivery = canWrite && liveProject.status === "completed";
  const canCreateReceipt = canWrite && Boolean(latestInvoice);

  const selectableQuotes = useMemo(
    () =>
      quotes
        .filter(
          (q) => q.projectId === liveProject.id && q.status !== "rejected"
        )
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [liveProject.id, quotes]
  );

  const [loadingAction, setLoadingAction] = useState<ProjectActionType | null>(
    null
  );
  const [creatingQuote, setCreatingQuote] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [creatingDelivery, setCreatingDelivery] = useState(false);
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [orderSelectOpen, setOrderSelectOpen] = useState(false);
  const [orderConfirmQuote, setOrderConfirmQuote] = useState<QuoteRecord | null>(
    null
  );

  const handleAction = async (action: ProjectActionType) => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    try {
      setLoadingAction(action);
      if (action === "mark_ordered") {
        const result = await confirmOrderForProject(project.id);
        if (result?.orderAlreadyExisted) {
          toast.message("注文書はすでに作成済みです");
          toast.success("受注を確定しました");
          return;
        }
        toast.success("受注確定し、注文書を作成しました", {
          description: result?.order?.orderNumber,
        });
        return;
      }
      if (action === "mark_completed") {
        await completeWorkForProject(project.id);
        toast.success("作業を完了しました");
        return;
      }
      if (action === "generate_invoice" || action === "view_invoice") {
        const href =
          action === "view_invoice"
            ? getProjectBillingViewHref(project.id, invoicesList)
            : resolveProjectInvoiceHref(project.id);
        router.push(href);
        return;
      }
      if (action === "mark_paid") {
        const updated = await markProjectPaid(project.id);
        if (!updated) {
          toast.error(PAYMENT_STATUS_UPDATE_FAILED_MESSAGE);
          return;
        }
        toast.success("入金済みにしました");
        return;
      }
      toast.success(getStatusChangeMessage(liveProject.status, action));
    } catch (error) {
      console.error("project action error", { action, projectId: project.id, error });
      if (action === "mark_ordered") {
        const message = getOrderCreationToastMessage(error);
        toast.error(message ?? "注文書の作成に失敗しました", {
          description: message ? undefined : formatSupabaseError(error),
        });
      } else if (action === "mark_paid") {
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
      } else {
        toast.error("操作に失敗しました", {
          description: formatSupabaseError(error),
        });
      }
    } finally {
      syncCustomerProjectCounts();
      setLoadingAction(null);
    }
  };

  const createOrderWithSource = async (quoteId: string | null) => {
    if (creatingOrder) return;
    try {
      setCreatingOrder(true);
      const order = await createOrderFromProject(liveProject.id, { quoteId });
      if (!order) {
        toast.error("注文書を作成できませんでした。再度お試しください。");
        return;
      }
      setOrderSelectOpen(false);
      setOrderConfirmQuote(null);
      toast.success("注文書を作成しました", { description: order.orderNumber });
      router.push(`/orders/${order.id}`);
    } catch (error) {
      console.error("handleCreateOrder failed", {
        projectId: liveProject.id,
        error,
      });
      const message = getOrderCreationToastMessage(error);
      toast.error(
        message ?? "注文書を作成できませんでした。再度お試しください。"
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  const proceedWithQuote = (quote: QuoteRecord) => {
    if (!isQuoteConfirmedForOrder(quote)) {
      setOrderSelectOpen(false);
      setOrderConfirmQuote(quote);
      return;
    }
    void createOrderWithSource(quote.id);
  };

  const handleCreateOrder = async () => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    if (creatingOrder) return;

    if (selectableQuotes.length === 0) {
      await createOrderWithSource(null);
      return;
    }
    if (selectableQuotes.length === 1) {
      proceedWithQuote(selectableQuotes[0]);
      return;
    }
    setOrderSelectOpen(true);
  };

  const handleCreateDeliveryNote = async () => {
    try {
      setCreatingDelivery(true);
      const note = await createDeliveryNoteFromProject(liveProject.id);
      if (!note) {
        toast.error("納品書の作成に失敗しました");
        return;
      }
      toast.success("納品書を作成しました", {
        description: note.deliveryNoteNumber,
      });
      router.push(`/delivery-notes/${note.id}`);
    } finally {
      setCreatingDelivery(false);
    }
  };

  const handleCreateReceipt = async () => {
    try {
      setCreatingReceipt(true);
      const receipt = await createReceiptFromProject(liveProject.id);
      if (!receipt) {
        toast.error("領収書の作成に失敗しました。先に請求書を作成してください。");
        return;
      }
      toast.success("領収書を作成しました", {
        description: receipt.receiptNumber,
      });
      router.push(`/receipts/${receipt.id}`);
    } finally {
      setCreatingReceipt(false);
    }
  };

  const handleCreateQuoteAndOpen = async () => {
    // 既存の /quotes/new の「保存」をスキップするため、ここで作成→表示まで行う
    const projectRecord = useProjectStore.getState().getProjectById(project.id);
    if (!projectRecord) return;
    try {
      setCreatingQuote(true);
      const { ensureDraftQuoteForProject, updateQuoteStatus } = await import("@/lib/services/quotes");
      const quote = await ensureDraftQuoteForProject(projectRecord);
      if (!quote) return;
      // 提出済み（sent）扱いにして、ユーザーに「提出済みにする」を押させない
      await updateQuoteStatus(quote.id, "sent");
      toast.success("見積書を作成して表示しました");
      router.push(`/quotes/${quote.id}`);
    } finally {
      setCreatingQuote(false);
    }
  };

  const handleDeleteRequest = () => {
    const reason = getProjectDeletionBlockReason(project.id);
    if (reason) {
      toast.error(reason);
      return;
    }
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteProject(project.id);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      syncCustomerProjectCounts();
      toast.success("案件を削除しました");
      router.push("/projects");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleArchiveToggle = async () => {
    setArchiving(true);
    try {
      const result = liveProject.archived
        ? await unarchiveProject(project.id)
        : await archiveProject(project.id);
      if (!result) {
        toast.error("案件が見つかりません");
        return;
      }
      toast.success(
        liveProject.archived ? "アーカイブを解除しました" : "案件をアーカイブしました"
      );
      syncCustomerProjectCounts();
    } catch (error) {
      toast.error(formatSupabaseError(error));
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          案件一覧に戻る
        </button>
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <>
              <Link
                href={`/projects/${project.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-xl"
                )}
              >
                <Pencil className="size-4" />
                編集
              </Link>
              <button
                type="button"
                disabled={archiving}
                onClick={() => void handleArchiveToggle()}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-xl"
                )}
              >
                {liveProject.archived ? (
                  <>
                    <ArchiveRestore className="size-4" />
                    アーカイブ解除
                  </>
                ) : (
                  <>
                    <Archive className="size-4" />
                    アーカイブ
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDeleteRequest}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
                )}
              >
                <Trash2 className="size-4" />
                削除
              </button>
            </>
          ) : null}
        </div>
      </div>

      <PageHeader
        title={liveProject.projectName}
        description={project.customerName}
      />

      <ProjectNextStepsPanel
        projectId={liveProject.id}
        status={liveProject.status}
        nextAction={nextAction}
        invoiceStatus={projectInvoiceState.invoiceStatus}
        paymentStatus={projectInvoiceState.paymentStatus}
        latestQuoteId={latestQuote?.id}
        invoices={invoicesList}
        onAction={handleAction}
        loadingAction={loadingAction}
        onCreateQuoteAndOpen={handleCreateQuoteAndOpen}
        creatingQuote={creatingQuote}
      />

      <div className="flex flex-wrap items-center gap-2">
        <ProjectStatusBadge status={liveProject.status} />
        {liveProject.archived && (
          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            アーカイブ済み
          </span>
        )}
        {billingStatus ? (
          <BillingProjectStatusBadge status={billingStatus} />
        ) : null}
        <span className="ml-auto rounded-lg bg-zinc-100 px-3 py-1 text-sm font-semibold tabular-nums text-zinc-700">
          {displayAmount > 0 ? formatCurrency(displayAmount) : "金額 —"}
        </span>
      </div>

      <Tabs
        key={`${liveProject.id}-${urlTab}`}
        defaultValue={urlTab}
        className="gap-6"
      >
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 overflow-x-auto border-b border-zinc-200/80 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger value="overview" className="shrink-0">概要</TabsTrigger>
          <TabsTrigger value="quote" className="shrink-0">見積</TabsTrigger>
          <TabsTrigger value="order" className="shrink-0">注文書</TabsTrigger>
          <TabsTrigger value="delivery" className="shrink-0">納品書</TabsTrigger>
          <TabsTrigger value="invoice" className="shrink-0">請求</TabsTrigger>
          <TabsTrigger value="receipt" className="shrink-0">領収書</TabsTrigger>
          <TabsTrigger value="history" className="shrink-0">履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <section className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-zinc-900">概要</h2>

            <dl className="grid gap-5 sm:grid-cols-2">
              <DetailItem
                icon={Building2}
                label="顧客"
                value={project.customerName}
              />
              <DetailItem
                icon={Calendar}
                label="納期"
                value={liveProject.dueDate ? formatDate(liveProject.dueDate) : "—"}
              />
              {liveProject.startDate ? (
                <DetailItem
                  icon={Calendar}
                  label="開始日"
                  value={formatDate(liveProject.startDate)}
                />
              ) : null}
              {liveProject.endDate ? (
                <DetailItem
                  icon={Calendar}
                  label="完了予定日"
                  value={formatDate(liveProject.endDate)}
                />
              ) : null}
              {liveProject.assigneeName ? (
                <DetailItem
                  icon={User}
                  label="担当者"
                  value={liveProject.assigneeName}
                />
              ) : null}
              {liveProject.constructionSite ? (
                <DetailItem
                  icon={MapPin}
                  label="工事場所"
                  value={liveProject.constructionSite}
                  className="sm:col-span-2"
                />
              ) : null}
              <div className="sm:col-span-2">
                <h3 className="mb-3 text-sm font-medium text-zinc-700">商品明細</h3>
                <ProjectItemsSummary items={projectItems} />
              </div>
              {project.memo && (
                <DetailItem
                  icon={FileText}
                  label="メモ"
                  value={project.memo}
                  className="sm:col-span-2"
                />
              )}
            </dl>

            <AuditTrailPanel audit={liveProject} className="mt-6" />
            <ActivityLogPanel
              targetType="project"
              targetId={liveProject.id}
              className="mt-4"
            />
          </section>
        </TabsContent>

        <TabsContent value="quote">
          {!latestQuote ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    まだ見積が作成されていません
                  </h3>
                  <p className="mt-2 text-sm text-zinc-500">
                    顧客・案件情報は自動反映されます。テンプレを選ぶだけで30秒で作成できます。
                  </p>
                </div>
                {canWrite ? (
                  <Link
                    href={`/quotes/new?projectId=${project.id}`}
                    className={cn(
                      buttonVariants(),
                      "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    見積を作成
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500">見積</p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                    {latestQuote.quoteNumber}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <QuoteStatusBadge status={latestQuote.status} />
                    <span className="text-sm text-zinc-500">
                      発行 {formatDate(latestQuote.issueDate)} / 期限{" "}
                      {formatDate(latestQuote.expiryDate)}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    合計
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                    {formatCurrency(Math.round(latestQuote.totalAmount))}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={`/quotes/${latestQuote.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-9 rounded-xl"
                  )}
                >
                  詳細を見る
                </Link>
                {canWrite ? (
                  <Link
                    href={`/quotes/${latestQuote.id}/edit`}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "h-9 rounded-xl"
                    )}
                  >
                    編集
                  </Link>
                ) : null}
                {canWrite ? (
                  <Link
                    href={`/quotes/new?projectId=${project.id}`}
                    className={cn(
                      buttonVariants(),
                      "h-9 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    追加で作成
                  </Link>
                ) : null}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="order">
          <ProjectDocumentTab
            label="注文書"
            emptyTitle="まだ注文書がありません"
            emptyDescription="「注文書を作成」で、見積書または案件の内容を引き継いで作成できます。"
            canCreate={canCreateOrder}
            blockedHint="失注案件では作成できません"
            createLabel="注文書を作成"
            creating={creatingOrder}
            onCreate={handleCreateOrder}
            latest={latestOrder}
            numberField="orderNumber"
            detailBasePath="/orders"
          />
        </TabsContent>

        <TabsContent value="delivery">
          <ProjectDocumentTab
            label="納品書"
            emptyTitle="まだ納品書がありません"
            emptyDescription="作業完了後、「納品書を作成」で作成できます。"
            canCreate={canCreateDelivery}
            blockedHint="作業完了後に作成できます"
            createLabel="納品書を作成"
            creating={creatingDelivery}
            onCreate={handleCreateDeliveryNote}
            latest={latestDeliveryNote}
            numberField="deliveryNoteNumber"
            detailBasePath="/delivery-notes"
          />
        </TabsContent>

        <TabsContent value="invoice">
          <div className="space-y-4">
            {invoiceTabState.cancelledCount > 0 && (
              <label className="flex items-center gap-2 text-sm text-zinc-600">
                <input
                  type="checkbox"
                  checked={showCancelledInvoices}
                  onChange={(e) => setShowCancelledInvoices(e.target.checked)}
                  className="size-4 rounded border-zinc-300"
                />
                キャンセル済みも表示（{invoiceTabState.cancelledCount}件）
              </label>
            )}

            {invoiceTabState.active.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {invoiceTabState.hasOnlyCancelled
                        ? "有効な請求書がありません"
                        : "まだ請求書がありません"}
                    </h3>
                    {liveProject.status !== "completed" ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        案件が完了すると、見積の内容をコピーして請求書を生成できます。
                      </p>
                    ) : latestQuote ? (
                      <p className="mt-2 text-sm text-zinc-500">
                        {invoiceTabState.hasOnlyCancelled
                          ? "キャンセル済みの請求書のみです。再発行する場合は新しい請求書を作成してください。"
                          : "見積内容をコピーして、請求書の下書きをすぐ作成できます。"}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-500">
                        先に見積を作成してください。
                      </p>
                    )}
                  </div>
                  {liveProject.status === "completed" && canWrite ? (
                    latestQuote ? (
                      <Link
                        href={resolveProjectInvoiceHref(liveProject.id)}
                        className={cn(
                          buttonVariants(),
                          "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                        )}
                      >
                        {invoiceTabState.hasOnlyCancelled
                          ? "再発行する"
                          : "請求書を発行"}
                      </Link>
                    ) : (
                      <Link
                        href={`/quotes/new?projectId=${project.id}`}
                        className={cn(
                          buttonVariants(),
                          "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                        )}
                      >
                        見積を作成
                      </Link>
                    )
                  ) : liveProject.status !== "completed" ? (
                    <span className="rounded-xl bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
                      案件完了後に生成
                    </span>
                  ) : null}
                </div>
              </div>
            ) : invoiceTabState.hasMultipleActive ? (
              <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-500">請求書</p>
                    <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                      {invoiceTabState.active.length}件の請求書
                    </h3>
                    <p className="mt-2 text-sm text-zinc-500">
                      この案件には複数の有効な請求書があります。
                    </p>
                  </div>
                  {liveProject.status === "completed" && canWrite && (
                    <Link
                      href={buildProjectInvoiceHref(liveProject.id, {
                        type: "additional",
                      })}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-9 rounded-xl"
                      )}
                    >
                      追加請求書を作成
                    </Link>
                  )}
                </div>
                <ul className="mt-6 space-y-3">
                  {invoiceTabState.active.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-100 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900">{inv.invoiceNumber}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <BillingStatusBadge
                            status={getInvoiceBillingDisplayStatus(inv)}
                          />
                          <span className="text-xs text-zinc-500">
                            {formatCurrency(Math.round(inv.totalAmount))}
                          </span>
                        </div>
                      </div>
                      <Link
                        href={`/invoices/${inv.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline", size: "sm" }),
                          "h-8 rounded-lg"
                        )}
                      >
                        詳細
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              invoiceTabState.primary && (
                <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-zinc-500">請求書</p>
                      <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                        {invoiceTabState.primary.invoiceNumber}
                      </h3>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <BillingStatusBadge
                          status={getInvoiceBillingDisplayStatus(invoiceTabState.primary)}
                        />
                        <span className="text-sm text-zinc-500">
                          発行 {formatDate(invoiceTabState.primary.issueDate)} / 期限{" "}
                          {formatDate(invoiceTabState.primary.dueDate)}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">
                        更新 {formatDateTime(invoiceTabState.primary.updatedAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                        合計
                      </p>
                      <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                        {formatCurrency(Math.round(invoiceTabState.primary.totalAmount))}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {invoiceTabState.primary ? (
                      <Link
                        href={`/invoices/${invoiceTabState.primary.id}`}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-9 rounded-xl",
                          getBillingStatusTheme(
                            getInvoiceBillingDisplayStatus(invoiceTabState.primary)
                          ).buttonOutlineClass
                        )}
                      >
                        {
                          getBillingStatusTheme(
                            getInvoiceBillingDisplayStatus(invoiceTabState.primary)
                          ).actionLabel
                        }
                      </Link>
                    ) : null}
                    {canWrite && invoiceTabState.primary.status === "draft" && (
                      <Link
                        href={`/invoices/${invoiceTabState.primary.id}/edit`}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-9 rounded-xl"
                        )}
                      >
                        編集
                      </Link>
                    )}
                    {liveProject.status === "completed" && canWrite && (
                      <Link
                        href={buildProjectInvoiceHref(liveProject.id, {
                          type: "additional",
                        })}
                        className={cn(
                          buttonVariants({ variant: "outline" }),
                          "h-9 rounded-xl"
                        )}
                      >
                        追加請求書を作成
                      </Link>
                    )}
                  </div>
                </div>
              )
            )}

            {showCancelledInvoices &&
              invoiceTabState.visible.some((inv) => inv.status === "cancelled") && (
                <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-5">
                  <p className="text-sm font-medium text-zinc-600">キャンセル済み</p>
                  <ul className="mt-3 space-y-2">
                    {invoiceTabState.visible
                      .filter((inv) => inv.status === "cancelled")
                      .map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200/80 bg-white px-3 py-2 text-sm"
                        >
                          <span className="text-zinc-700">{inv.invoiceNumber}</span>
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
                          >
                            詳細
                          </Link>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
          </div>
        </TabsContent>

        <TabsContent value="receipt">
          <ProjectDocumentTab
            label="領収書"
            emptyTitle="まだ領収書がありません"
            emptyDescription="請求書作成後、「領収書を作成」で作成できます（入金前でも印刷可能）。"
            canCreate={canCreateReceipt}
            blockedHint="請求書作成後に作成できます"
            createLabel="領収書を作成"
            creating={creatingReceipt}
            onCreate={handleCreateReceipt}
            latest={latestReceipt}
            numberField="receiptNumber"
            detailBasePath="/receipts"
          />
        </TabsContent>

        <TabsContent value="history">
          <section className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
            <h2 className="mb-6 text-lg font-semibold text-zinc-900">履歴</h2>
            <ProjectTimeline events={history} />
          </section>
        </TabsContent>
      </Tabs>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="案件を削除しますか？"
        description={`「${liveProject.projectName}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <CreateOrderQuoteSelectDialog
        open={orderSelectOpen}
        onOpenChange={setOrderSelectOpen}
        quotes={selectableQuotes}
        loading={creatingOrder}
        onSelectQuote={proceedWithQuote}
        onSelectProject={() => {
          void createOrderWithSource(null);
        }}
      />

      <CreateOrderUnconfirmedDialog
        open={Boolean(orderConfirmQuote)}
        onOpenChange={(open) => {
          if (!open) setOrderConfirmQuote(null);
        }}
        loading={creatingOrder}
        onConfirm={() => {
          if (!orderConfirmQuote) return;
          void createOrderWithSource(orderConfirmQuote.id);
        }}
      />
    </div>
  );
}

function ProjectDocumentTab({
  label,
  emptyTitle,
  emptyDescription,
  canCreate,
  blockedHint,
  createLabel,
  creating,
  onCreate,
  latest,
  numberField,
  detailBasePath,
}: {
  label: string;
  emptyTitle: string;
  emptyDescription: string;
  canCreate: boolean;
  blockedHint: string;
  createLabel: string;
  creating: boolean;
  onCreate: () => Promise<void>;
  latest?: {
    id: string;
    issueDate: string;
    totalAmount: number;
    updatedAt: string;
  } & Record<string, string | number | null>;
  numberField: string;
  detailBasePath: string;
}) {
  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-zinc-900">{emptyTitle}</h3>
            <p className="mt-2 text-sm text-zinc-500">{emptyDescription}</p>
          </div>
          {canCreate ? (
            <button
              type="button"
              onClick={() => void onCreate()}
              disabled={creating}
              className={cn(
                buttonVariants(),
                "h-9 w-full shrink-0 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 sm:w-auto"
              )}
            >
              {createLabel}
            </button>
          ) : (
            <span className="rounded-xl bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
              {blockedHint}
            </span>
          )}
        </div>
      </div>
    );
  }

  const docNumber = String(latest[numberField] ?? "");

  return (
    <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">{docNumber}</h3>
          <p className="mt-3 text-sm text-zinc-500">
            発行 {formatDate(latest.issueDate)}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            更新 {formatDateTime(latest.updatedAt)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            合計
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {formatCurrency(Math.round(latest.totalAmount))}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Link
          href={`${detailBasePath}/${latest.id}`}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 w-full rounded-xl sm:w-auto"
          )}
        >
          詳細を見る
        </Link>
        {canCreate ? (
          <button
            type="button"
            onClick={() => void onCreate()}
            disabled={creating}
            className={cn(
              buttonVariants(),
              "h-9 w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 sm:w-auto"
            )}
          >
            追加で作成
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DetailItem({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-1.5 text-sm text-zinc-500">
        {Icon && <Icon className="size-3.5" strokeWidth={1.5} />}
        {label}
      </dt>
      <dd className="mt-1 text-base font-medium text-zinc-900">{value}</dd>
    </div>
  );
}

