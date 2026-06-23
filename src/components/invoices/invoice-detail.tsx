"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
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

function isOverdue(dueDate: string) {
  if (!dueDate) return false;
  const due = new Date(dueDate + "T23:59:59");
  return due < new Date();
}

function displayStatus(inv: InvoiceRecord): InvoiceDocumentStatus {
  if ((inv.status === "issued" || inv.status === "sent") && isOverdue(inv.dueDate)) {
    return "overdue";
  }
  return inv.status;
}

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
  const [cancelOpen, setCancelOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const status = displayStatus(invoice);
  const actions = getInvoiceQuickActions(status);
  const deleteBlockReason = getInvoiceDeletionBlockReason(invoice.id);
  const cancelBlockReason = getInvoiceCancelBlockReason(invoice.id);
  const deletable = canDeleteInvoice(invoice.id);
  const handlePrint = () => {
    toast.message("印刷画面を開きます。保存先でPDFを選択できます。");
    window.print();
  };

  const change = async (next: InvoiceActionType) => {
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
    <div className="mx-auto max-w-6xl space-y-8 px-8 py-10">
      <div className="print-hidden flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/invoices")}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          請求書一覧に戻る
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/invoices/${invoice.id}/edit`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "rounded-xl"
            )}
          >
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
              onClick={handlePrint}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-9 gap-2 rounded-xl"
              )}
            >
              <Printer className="size-4" />
              印刷/PDF保存
            </button>
            {actions.map((a) => (
              <InvoiceActionButton
                key={a}
                action={a}
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
            ))}
          </div>
        }
      />

      {!deletable && deleteBlockReason && invoice.status !== "draft" && (
        <div className="print-hidden rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {deleteBlockReason}
        </div>
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

      <InvoicePreview
        invoice={invoice}
        customer={customer}
        items={items}
        projectName={projectName}
        constructionSite={constructionSite}
      />

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

