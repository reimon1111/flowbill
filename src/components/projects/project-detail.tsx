"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";
import type {
  ProjectActionType,
  ProjectHistoryEvent,
  ProjectListItem,
} from "@/lib/types";
import {
  InvoiceStatusBadge,
  ProjectPaymentStatusBadge,
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
  issueInvoiceForProject,
  markProjectPaid,
  syncCustomerProjectCounts,
} from "@/lib/services/projects";
import { formatSupabaseError } from "@/lib/db/errors";
import { useProjectStore } from "@/stores/project-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useQuoteStore } from "@/stores/quote-store";
import { ProjectItemsSummary } from "@/components/projects/project-items-summary";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useOrderStore } from "@/stores/order-store";
import { useDeliveryNoteStore } from "@/stores/delivery-note-store";
import { useReceiptStore } from "@/stores/receipt-store";
import { InvoiceStatusBadge as InvoiceDocStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatDateTime } from "@/lib/format";
import {
  createDeliveryNoteFromProject,
  createOrderFromProject,
  createReceiptFromProject,
} from "@/lib/services/commercial-documents";

type ProjectDetailProps = {
  project: ProjectListItem;
  history: ProjectHistoryEvent[];
};

export function ProjectDetail({ project, history }: ProjectDetailProps) {
  const router = useRouter();
  const liveProject =
    useProjectStore((s) => s.projects.find((p) => p.id === project.id)) ?? project;
  const nextAction = useMemo(
    () =>
      getNextAction({
        status: liveProject.status,
        invoiceStatus: liveProject.invoiceStatus,
        paymentStatus: liveProject.paymentStatus,
      }),
    [liveProject.status, liveProject.invoiceStatus, liveProject.paymentStatus]
  );
  const quotes = useQuoteStore((s) => s.quotes);
  const projectItemsList = useProjectItemStore((s) => s.projectItems);
  const invoicesList = useInvoiceStore((s) => s.invoices);
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
        .filter((inv) => inv.projectId === liveProject.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [invoicesList, liveProject.id]
  );
  const latestOrder = useMemo(
    () =>
      ordersList
        .filter((o) => o.projectId === liveProject.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [ordersList, liveProject.id]
  );
  const latestDeliveryNote = useMemo(
    () =>
      deliveryNotesList
        .filter((d) => d.projectId === liveProject.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [deliveryNotesList, liveProject.id]
  );
  const latestReceipt = useMemo(
    () =>
      receiptsList
        .filter((r) => r.projectId === liveProject.id)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0],
    [receiptsList, liveProject.id]
  );

  const canCreateOrder =
    liveProject.status !== "estimate" && liveProject.status !== "lost";
  const canCreateDelivery = liveProject.status === "completed";
  const canCreateReceipt = Boolean(latestInvoice);

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

  const handleAction = async (action: ProjectActionType) => {
    try {
      setLoadingAction(action);
      if (action === "mark_ordered") {
        await confirmOrderForProject(project.id);
        toast.success("受注を確定しました");
        return;
      }
      if (action === "mark_completed") {
        await completeWorkForProject(project.id);
        toast.success("作業を完了しました");
        return;
      }
      if (action === "generate_invoice") {
        const invoice = await issueInvoiceForProject(project.id);
        if (invoice) router.push(`/invoices/${invoice.id}`);
        toast.success("請求書を発行しました");
        return;
      }
      if (action === "mark_paid") {
        await markProjectPaid(project.id);
        toast.success("入金済みにしました");
        return;
      }
      toast.success(getStatusChangeMessage(liveProject.status, action));
    } catch (error) {
      toast.error("操作に失敗しました", {
        description: formatSupabaseError(error),
      });
    } finally {
      syncCustomerProjectCounts();
      setLoadingAction(null);
    }
  };

  const handleCreateOrder = async () => {
    try {
      setCreatingOrder(true);
      const order = await createOrderFromProject(liveProject.id);
      if (!order) {
        toast.error("注文書の作成に失敗しました");
        return;
      }
      toast.success("注文書を作成しました", { description: order.orderNumber });
      router.push(`/orders/${order.id}`);
    } catch (error) {
      toast.error("注文書の作成に失敗しました", {
        description: formatSupabaseError(error),
      });
    } finally {
      setCreatingOrder(false);
    }
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
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-10">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/projects")}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          案件一覧に戻る
        </button>
        <div className="flex flex-wrap items-center gap-2">
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
        invoiceStatus={liveProject.invoiceStatus}
        paymentStatus={liveProject.paymentStatus}
        latestQuoteId={latestQuote?.id}
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
        <InvoiceStatusBadge status={liveProject.invoiceStatus} />
        <ProjectPaymentStatusBadge status={liveProject.paymentStatus} />
        <span className="ml-auto rounded-lg bg-zinc-100 px-3 py-1 text-sm font-semibold tabular-nums text-zinc-700">
          {liveProject.amount > 0 ? formatCurrency(liveProject.amount) : "金額 —"}
        </span>
      </div>

      <Tabs defaultValue="overview" className="gap-6">
        <TabsList
          variant="line"
          className="w-full justify-start gap-2 border-b border-zinc-200/80 pb-2"
        >
          <TabsTrigger value="overview">概要</TabsTrigger>
          <TabsTrigger value="quote">見積</TabsTrigger>
          <TabsTrigger value="order">注文書</TabsTrigger>
          <TabsTrigger value="delivery">納品書</TabsTrigger>
          <TabsTrigger value="invoice">請求</TabsTrigger>
          <TabsTrigger value="receipt">領収書</TabsTrigger>
          <TabsTrigger value="history">履歴</TabsTrigger>
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
                <Link
                  href={`/quotes/new?projectId=${project.id}`}
                  className={cn(
                    buttonVariants(),
                    "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                  )}
                >
                  見積を作成
                </Link>
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
                <Link
                  href={`/quotes/${latestQuote.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-9 rounded-xl"
                  )}
                >
                  編集
                </Link>
                <Link
                  href={`/quotes/new?projectId=${project.id}`}
                  className={cn(
                    buttonVariants(),
                    "h-9 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                  )}
                >
                  追加で作成
                </Link>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="order">
          <ProjectDocumentTab
            label="注文書"
            emptyTitle="まだ注文書がありません"
            emptyDescription="受注確定後、「注文書を作成」で作成できます。"
            canCreate={canCreateOrder}
            blockedHint="受注確定後に作成できます"
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
          {!latestInvoice ? (
            <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">
                    まだ請求書がありません
                  </h3>
                  {liveProject.status !== "completed" ? (
                    <p className="mt-2 text-sm text-zinc-500">
                      案件が完了すると、見積の内容をコピーして請求書を生成できます。
                    </p>
                  ) : latestQuote ? (
                    <p className="mt-2 text-sm text-zinc-500">
                      見積内容をコピーして、請求書の下書きをすぐ作成できます。
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-zinc-500">
                      先に見積を作成してください。
                    </p>
                  )}
                </div>
                {liveProject.status === "completed" ? (
                  latestQuote ? (
                    <Link
                      href={`/invoices/new?projectId=${project.id}`}
                      className={cn(
                        buttonVariants(),
                        "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                      )}
                    >
                      請求書を生成
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
                ) : (
                  <span className="rounded-xl bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500">
                    案件完了後に生成
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-zinc-200/80 bg-white p-6 shadow-sm shadow-zinc-900/[0.02] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-zinc-500">請求書</p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-900">
                    {latestInvoice.invoiceNumber}
                  </h3>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <InvoiceDocStatusBadge status={latestInvoice.status} />
                    <span className="text-sm text-zinc-500">
                      発行 {formatDate(latestInvoice.issueDate)} / 期限{" "}
                      {formatDate(latestInvoice.dueDate)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-400">
                    更新 {formatDateTime(latestInvoice.updatedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
                    合計
                  </p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
                    {formatCurrency(Math.round(latestInvoice.totalAmount))}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  href={`/invoices/${latestInvoice.id}`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-9 rounded-xl"
                  )}
                >
                  詳細を見る
                </Link>
                <Link
                  href={`/invoices/${latestInvoice.id}/edit`}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-9 rounded-xl"
                  )}
                >
                  編集
                </Link>
                {project.status === "completed" && (
                  <Link
                    href={`/invoices/new?projectId=${project.id}`}
                    className={cn(
                      buttonVariants(),
                      "h-9 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                    )}
                  >
                    追加で生成
                  </Link>
                )}
              </div>
            </div>
          )}
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
  } & Record<string, string | number>;
  numberField: string;
  detailBasePath: string;
}) {
  if (!latest) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-white p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
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
                "h-9 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <h3 className="mt-1 text-lg font-semibold text-zinc-900">{docNumber}</h3>
          <p className="mt-3 text-sm text-zinc-500">
            発行 {formatDate(latest.issueDate)}
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            更新 {formatDateTime(latest.updatedAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            合計
          </p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900">
            {formatCurrency(Math.round(latest.totalAmount))}
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`${detailBasePath}/${latest.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "h-9 rounded-xl")}
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
              "h-9 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
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

