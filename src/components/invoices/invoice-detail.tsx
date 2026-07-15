"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DocumentBackLinks } from "@/components/shared/document-back-links";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  Customer,
  InvoiceDocumentStatus,
  InvoiceItemRecord,
  InvoiceRecord,
} from "@/lib/types";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoicePreview } from "@/components/invoices/invoice-preview";
import {
  cancelInvoice,
  deleteInvoice,
  getInvoiceCancelBlockReason,
  getInvoiceDeletionBlockReason,
  canDeleteInvoice,
  canSoftDeleteInvoice,
  updateInvoiceStatus,
} from "@/lib/services/invoices";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { useState } from "react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import {
  getInvoiceQuickActions,
  InvoiceActionButton,
  type InvoiceActionType,
} from "@/components/invoices/invoice-action-button";
import { AuditTrailPanel } from "@/components/shared/audit-trail-panel";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DocumentPreviewCollapsible } from "@/components/shared/document-preview-collapsible";
import { useDocumentExport } from "@/hooks/use-document-export";
import { LinePdfExportGuide } from "@/components/shared/line-pdf-export-guide";

import { getInvoiceListDisplayStatus } from "@/lib/payment-utils";

export function InvoiceDetail({
  invoice,
  customer,
  projectName,
  constructionSite = "",
  quoteNumber,
  items,
}: {
  invoice: InvoiceRecord;
  customer: Customer;
  projectName: string;
  constructionSite?: string;
  quoteNumber: string;
  items: InvoiceItemRecord[];
}) {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  const isMobile = useIsMobile();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { previewOpen, setPreviewOpen, lineGuideOpen, setLineGuideOpen, onExport } =
    useDocumentExport();
  const status = getInvoiceListDisplayStatus(invoice);
  const actions = getInvoiceQuickActions(status);
  const deleteBlockReason = getInvoiceDeletionBlockReason(invoice.id);
  const cancelBlockReason = getInvoiceCancelBlockReason(invoice.id);
  const deletable = canDeleteInvoice(invoice.id);
  const canSoftDelete = canSoftDeleteInvoice();
  const exportLabel = isMobile ? "PDFを保存" : "印刷 / PDF保存";

  const change = async (next: InvoiceActionType) => {
    if (actionLoading) return;
    setActionLoading(true);
    try {
    const map: Record<InvoiceActionType, InvoiceDocumentStatus> = {
      mark_issued: "issued",
      mark_sent: "sent",
      mark_paid: "paid",
      cancel: "cancelled",
    };

    if (next === "cancel") {
      const result = await cancelInvoice(invoice.id);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      toast.success("請求書をキャンセルしました");
      return;
    }

    const updated = await updateInvoiceStatus(invoice.id, map[next]);
    if (!updated) return;

    if (next === "mark_issued") {
      toast.success("請求書を発行済みにしました", {
        description: "案件の請求状態が更新されました（案件ステータスは完了のまま）",
      });
    } else if (next === "mark_sent") {
      toast.success("請求書を送付済みにしました");
    } else if (next === "mark_paid") {
      toast.success("入金済みにしました", {
        description: "案件の入金状態が更新されました（案件ステータスは完了のまま）",
      });
    }
    } finally {
      setActionLoading(false);
    }
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
      const result = await deleteInvoice(invoice.id);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      toast.success("請求書を削除しました");
      router.push("/invoices");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="print-hidden flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <DocumentBackLinks listHref="/invoices" projectId={invoice.projectId} />
        <div className="flex flex-wrap items-center gap-2">
          {canWrite ? (
            <>
              <Link
                href={`/invoices/${invoice.id}/edit`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "rounded-xl"
                )}
              >
                <Pencil className="size-4" />
                編集
              </Link>
              {deletable && (
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
              )}
            </>
          ) : null}
        </div>
      </div>

      <PageHeader
        title={invoice.invoiceNumber}
        description={`${projectName} / ${customer.customerName}（元見積 ${quoteNumber}）`}
        action={
          <div className="print-hidden flex flex-wrap items-center gap-2">
            <InvoiceStatusBadge status={status} />
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
            {canWrite
              ? actions.map((a) => (
                  <InvoiceActionButton
                    key={a}
                    action={a}
                    disabled={actionLoading}
                    onAction={(act) => {
                      if (act === "cancel") {
                        if (cancelBlockReason) {
                          toast.error(cancelBlockReason);
                          return;
                        }
                        setCancelOpen(true);
                        return;
                      }
                      void change(act);
                    }}
                  />
                ))
              : null}
          </div>
        }
      />

      {!deletable && deleteBlockReason && invoice.status !== "draft" && !invoice.deletedAt && (
        <div className="print-hidden rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {deleteBlockReason}
        </div>
      )}

      {invoice.deletedAt && (
        <div className="print-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          この請求書は削除済みです（{formatDateTime(invoice.deletedAt)}）。
        </div>
      )}

      {!invoice.deletedAt && invoice.status !== "draft" && canSoftDelete && deletable && (
        <p className="print-hidden text-xs text-zinc-500">
          発行済みの請求書は論理削除されます。一覧・集計からは非表示になります。
        </p>
      )}

      {invoice.status === "paid" && (
        <div className="print-hidden rounded-xl border border-zinc-200/80 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
          入金済みの請求書は削除・キャンセルできません。
        </div>
      )}

      <div className="print-hidden flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-900/[0.02]">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            発行日 / 支払期限
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {formatDate(invoice.issueDate)} — {formatDate(invoice.dueDate)}
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            合計
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">
            {formatCurrency(Math.round(invoice.totalAmount))}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            更新 {formatDateTime(invoice.updatedAt)}
          </p>
        </div>
      </div>

      <AuditTrailPanel audit={invoice} />

      <ActivityLogPanel targetType="invoice" targetId={invoice.id} className="mt-4" />

      <LinePdfExportGuide
        open={lineGuideOpen}
        onClose={() => setLineGuideOpen(false)}
      />

      <DocumentPreviewCollapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <InvoicePreview
          invoice={invoice}
          customer={customer}
          items={items}
          projectName={projectName}
          constructionSite={constructionSite}
        />
      </DocumentPreviewCollapsible>

      <DeleteConfirmDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="請求書をキャンセルしますか？"
        description="キャンセル後も履歴として残ります。案件の請求状態も更新されます。"
        onConfirm={() => {
          setCancelOpen(false);
          void change("cancel");
        }}
      />

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="請求書を削除しますか？"
        description={`「${invoice.invoiceNumber}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

