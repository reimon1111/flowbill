"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import type { CommercialDocumentItemRecord } from "@/lib/commercial-document";
import type { CommercialDocView } from "@/lib/commercial-document";
import { CommercialDocumentPreview } from "@/components/documents/commercial-document-preview";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { AuditTrailPanel } from "@/components/shared/audit-trail-panel";
import { ActivityLogPanel } from "@/components/shared/activity-log-panel";
import { DocumentBackLinks } from "@/components/shared/document-back-links";
import type { AuditMetadata } from "@/lib/types/audit";
import type { ActivityLogTargetType } from "@/lib/types/activity-log";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { DocumentPreviewCollapsible } from "@/components/shared/document-preview-collapsible";
import { useDocumentExport } from "@/hooks/use-document-export";
import { LinePdfExportGuide } from "@/components/shared/line-pdf-export-guide";

type DeleteConfig = {
  confirmDescription: string;
  successToast: string;
  onDelete: () => Promise<{ ok: true } | { ok: false }>;
};

export function CommercialDocumentDetail({
  kind,
  documentNumber,
  issueDate,
  paymentTerms,
  totalAmount,
  projectName,
  constructionSite = "",
  customer,
  items,
  document,
  backHref,
  projectId,
  editHref,
  secondDate,
  bankAccountId,
  recipientName,
  isDeleted = false,
  deleteConfig,
  audit,
  activityTargetType,
  activityTargetId,
}: {
  kind: DocumentKind;
  documentNumber: string;
  issueDate: string;
  paymentTerms: string;
  totalAmount: number;
  projectName: string;
  constructionSite?: string;
  customer: Customer;
  items: CommercialDocumentItemRecord[];
  document: CommercialDocView;
  backHref: string;
  projectId: string;
  editHref?: string;
  secondDate?: string;
  bankAccountId?: string | null;
  recipientName?: string;
  isDeleted?: boolean;
  deleteConfig?: DeleteConfig;
  audit?: AuditMetadata;
  activityTargetType?: ActivityLogTargetType;
  activityTargetId?: string;
}) {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  const isMobile = useIsMobile();
  const labels = getDocumentLabels(kind);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { previewOpen, setPreviewOpen, lineGuideOpen, setLineGuideOpen, onExport } =
    useDocumentExport();
  const exportLabel = isMobile ? "PDFを保存" : "印刷 / PDF保存";

  const handleDelete = async () => {
    if (!deleteConfig) return;
    setDeleting(true);
    try {
      const result = await deleteConfig.onDelete();
      if (!result.ok) {
        toast.error("削除に失敗しました");
        return;
      }
      toast.success(deleteConfig.successToast);
      router.push(backHref);
    } catch (error) {
      console.error("commercial document delete", error);
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <div className="print-hidden flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <DocumentBackLinks listHref={backHref} projectId={projectId} />
        <div className="flex flex-wrap gap-2">
          {!isDeleted && editHref && canWrite ? (
            <Link
              href={editHref}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-9 gap-2 rounded-xl"
              )}
            >
              <Pencil className="size-4" />
              編集
            </Link>
          ) : null}
          {!isDeleted && deleteConfig && canWrite ? (
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-9 gap-2 rounded-xl text-red-600 hover:bg-red-50 hover:text-red-700"
              )}
            >
              <Trash2 className="size-4" />
              削除
            </button>
          ) : null}
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
        </div>
      </div>

      <div className="print-hidden">
        <PageHeader
          title={labels.title}
          description={`${documentNumber} / ${projectName}`}
        />
        {isDeleted ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            この{labels.title}は削除済みです。一覧には表示されません。
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-zinc-200/80 bg-white px-5 py-4 text-sm">
          <div>
            <p className="text-xs text-zinc-400">発行日</p>
            <p className="font-medium">{formatDate(issueDate)}</p>
          </div>
          {labels.showPaymentTerms ? (
            <div>
              <p className="text-xs text-zinc-400">支払い条件</p>
              <p className="font-medium">{paymentTerms || "—"}</p>
            </div>
          ) : null}
          <div>
            <p className="text-xs text-zinc-400">合計</p>
            <p className="font-semibold tabular-nums">
              {formatCurrency(Math.round(totalAmount))}
            </p>
          </div>
        </div>
      </div>

      {audit ? <AuditTrailPanel audit={audit} /> : null}

      {activityTargetType && activityTargetId ? (
        <ActivityLogPanel
          targetType={activityTargetType}
          targetId={activityTargetId}
          className="mt-4"
        />
      ) : null}

      <LinePdfExportGuide
        open={lineGuideOpen}
        onClose={() => setLineGuideOpen(false)}
      />

      <DocumentPreviewCollapsible open={previewOpen} onOpenChange={setPreviewOpen}>
        <CommercialDocumentPreview
          kind={kind}
          document={document}
          customer={customer}
          items={items}
          projectName={projectName}
          constructionSite={constructionSite}
          secondDate={secondDate}
          bankAccountId={bankAccountId}
          recipientName={recipientName}
        />
      </DocumentPreviewCollapsible>

      {deleteConfig ? (
        <DeleteConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title={`${labels.title}を削除`}
          description={deleteConfig.confirmDescription}
          onConfirm={handleDelete}
          loading={deleting}
        />
      ) : null}
    </div>
  );
}
