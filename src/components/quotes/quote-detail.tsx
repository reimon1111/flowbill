"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Printer, Send, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentBackLinks } from "@/components/shared/document-back-links";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Customer, QuoteItemRecord, QuoteRecord, QuoteStatus } from "@/lib/types";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { QuotePreview } from "@/components/quotes/quote-preview";
import {
  deleteQuote,
  getQuoteDeletionBlockReason,
  canDeleteQuote,
  updateQuoteStatus,
} from "@/lib/services/quotes";
import { createOrderFromQuote } from "@/lib/services/commercial-documents";
import { isQuoteConfirmedForOrder } from "@/lib/order-create-source";
import { CreateOrderUnconfirmedDialog } from "@/components/orders/create-order-dialogs";
import { getOrderCreationToastMessage } from "@/lib/order-creation-error";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { formatSupabaseError } from "@/lib/db/errors";
import { useState } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { QUOTE_EXPIRY_TYPE_LABELS } from "@/lib/quote-expiry";
import { AuditTrailPanel } from "@/components/shared/audit-trail-panel";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { VIEWER_WRITE_DENIED_MESSAGE } from "@/lib/guards/write-access";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DocumentPreviewCollapsible } from "@/components/shared/document-preview-collapsible";
import { useDocumentExport } from "@/hooks/use-document-export";
import { LinePdfExportGuide } from "@/components/shared/line-pdf-export-guide";

export function QuoteDetail({
  quote,
  customer,
  projectName,
  constructionSite = "",
  items,
}: {
  quote: QuoteRecord;
  customer: Customer;
  projectName: string;
  constructionSite?: string;
  items: QuoteItemRecord[];
}) {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  const isMobile = useIsMobile();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [statusChanging, setStatusChanging] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderConfirmOpen, setOrderConfirmOpen] = useState(false);
  const { previewOpen, setPreviewOpen, lineGuideOpen, setLineGuideOpen, onExport } =
    useDocumentExport();
  const deleteBlockReason = getQuoteDeletionBlockReason(quote.id);
  const deletable = canDeleteQuote(quote.id);
  const canCreateOrderFromQuote =
    canWrite && quote.status !== "rejected";
  const exportLabel = isMobile ? "PDFを保存" : "印刷 / PDF保存";

  const changeStatus = async (status: QuoteStatus) => {
    if (statusChanging) return;
    setStatusChanging(true);
    try {
    const updated = await updateQuoteStatus(quote.id, status);
    if (!updated) return;

    if (status === "sent") {
      toast.success("見積を提出済みにしました", {
        description: "案件ステータスは「見積中」のままです",
      });
    } else if (status === "accepted") {
      toast.success("見積を承認しました");
    } else if (status === "rejected") {
      toast.success("見積を否認しました", {
        description: "案件ステータスを「失注」に更新しました",
      });
    } else {
      toast.success("見積ステータスを更新しました");
    }
    } finally {
      setStatusChanging(false);
    }
  };

  const createOrder = async () => {
    if (creatingOrder) return;
    try {
      setCreatingOrder(true);
      const order = await createOrderFromQuote(quote.id);
      if (!order) {
        toast.error("注文書を作成できませんでした。再度お試しください。");
        return;
      }
      setOrderConfirmOpen(false);
      toast.success("注文書を作成しました", { description: order.orderNumber });
      router.push(`/orders/${order.id}`);
    } catch (error) {
      console.error("createOrderFromQuote failed", { quoteId: quote.id, error });
      const message = getOrderCreationToastMessage(error);
      toast.error(
        message ?? "注文書を作成できませんでした。再度お試しください。"
      );
    } finally {
      setCreatingOrder(false);
    }
  };

  const handleCreateOrderRequest = () => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    if (creatingOrder) return;
    if (!isQuoteConfirmedForOrder(quote)) {
      setOrderConfirmOpen(true);
      return;
    }
    void createOrder();
  };

  const handleDeleteRequest = () => {
    if (deleteBlockReason) {
      toast.error(deleteBlockReason);
      return;
    }
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteQuote(quote.id);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      toast.success("見積を削除しました");
      router.push("/quotes");
    } catch (error) {
      toast.error(formatSupabaseError(error));
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="print-hidden flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <DocumentBackLinks listHref="/quotes" projectId={quote.projectId} />
        <div className="flex flex-wrap items-center gap-2">
        {canWrite ? (
          <>
        <Link
          href={`/quotes/${quote.id}/edit`}
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
          onClick={handleDeleteRequest}
          title={deleteBlockReason ?? undefined}
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700",
            !deletable && "opacity-60"
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
        title={quote.quoteNumber}
        description={`${projectName} / ${customer.customerName}`}
        action={
          <div className="print-hidden flex flex-wrap items-center gap-2">
            <QuoteStatusBadge status={quote.status} />
            <button
              type="button"
              onClick={onExport}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-10 min-h-10 gap-2 rounded-xl sm:h-9"
              )}
            >
              <Printer className="size-4" />
              {exportLabel}
            </button>
            {canWrite && quote.status === "draft" && (
              <button
                type="button"
                disabled={statusChanging}
                onClick={() => changeStatus("sent")}
                className={cn(
                  buttonVariants(),
                  "h-9 w-full gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 sm:w-auto"
                )}
              >
                <Send className="size-4" />
                提出済みにする
              </button>
            )}
            {canWrite && quote.status === "sent" && (
              <>
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => changeStatus("accepted")}
                  className={cn(
                    buttonVariants(),
                    "h-9 w-full gap-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 sm:w-auto"
                  )}
                >
                  <ThumbsUp className="size-4" />
                  承認にする
                </button>
                <button
                  type="button"
                  disabled={statusChanging}
                  onClick={() => setRejectOpen(true)}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "h-9 w-full gap-2 rounded-xl sm:w-auto"
                  )}
                >
                  <ThumbsDown className="size-4" />
                  否認にする
                </button>
              </>
            )}
            {canCreateOrderFromQuote ? (
              <button
                type="button"
                disabled={creatingOrder}
                onClick={handleCreateOrderRequest}
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "h-9 w-full rounded-xl sm:w-auto"
                )}
              >
                この見積書から注文書を作成
              </button>
            ) : null}
            {!deletable && quote.status === "accepted" && (
              <p className="text-xs text-zinc-500">
                承認済みの見積は削除できません。案件の失注またはアーカイブをご利用ください。
              </p>
            )}
          </div>
        }
      />

      {!deletable && deleteBlockReason && quote.status !== "accepted" && (
        <div className="print-hidden rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {deleteBlockReason}
          {quote.status === "sent" && (
            <span className="ml-1">不要な場合は「否認にする」をご利用ください。</span>
          )}
        </div>
      )}

      <div className="print-hidden flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-900/[0.02]">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            発行日
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {formatDate(quote.issueDate)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            有効期限
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {QUOTE_EXPIRY_TYPE_LABELS[quote.expiryType]}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            有効期限日
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {formatDate(quote.expiryDate)}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            合計
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {formatCurrency(Math.round(quote.totalAmount))}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            更新 {formatDateTime(quote.updatedAt)}
          </p>
        </div>
      </div>

      <AuditTrailPanel audit={quote} />

      <ActivityLogPanel targetType="quote" targetId={quote.id} className="mt-4" />

      <LinePdfExportGuide
        open={lineGuideOpen}
        onClose={() => setLineGuideOpen(false)}
      />

      <DocumentPreviewCollapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <QuotePreview
          quote={quote}
          customer={customer}
          items={items}
          projectName={projectName}
          constructionSite={constructionSite}
        />
      </DocumentPreviewCollapsible>

      <DeleteConfirmDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        title="見積を否認にしますか？"
        description="否認にすると案件ステータスを「失注」に更新します。"
        onConfirm={() => {
          setRejectOpen(false);
          void changeStatus("rejected");
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="見積を削除しますか？"
        description={`「${quote.quoteNumber}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        loading={deleting}
      />

      <CreateOrderUnconfirmedDialog
        open={orderConfirmOpen}
        onOpenChange={setOrderConfirmOpen}
        loading={creatingOrder}
        onConfirm={() => void createOrder()}
      />
    </div>
  );
}

