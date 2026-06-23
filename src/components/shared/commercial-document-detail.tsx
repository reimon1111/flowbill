"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Customer } from "@/lib/types";
import type { DocumentKind } from "@/components/documents/document-labels";
import { getDocumentLabels } from "@/components/documents/document-labels";
import type { CommercialDocumentItemRecord } from "@/lib/commercial-document";
import { CommercialDocumentPreview } from "@/components/documents/commercial-document-preview";

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
  editHref,
  secondDate,
  bankAccountId,
  recipientName,
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
  document: {
    documentNumber: string;
    issueDate: string;
    paymentTerms: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    memo: string;
  };
  backHref: string;
  editHref?: string;
  secondDate?: string;
  bankAccountId?: string | null;
  recipientName?: string;
}) {
  const labels = getDocumentLabels(kind);

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-8 py-10">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900"
        >
          <ArrowLeft className="size-4" />
          一覧に戻る
        </Link>
        <div className="flex flex-wrap gap-2">
          {editHref ? (
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
          <button
            type="button"
            onClick={() => window.print()}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-9 gap-2 rounded-xl"
            )}
          >
            <Printer className="size-4" />
            印刷 / PDF保存
          </button>
        </div>
      </div>

      <div className="print-hidden">
        <PageHeader
          title={labels.title}
          description={`${documentNumber} / ${projectName}`}
        />
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
    </div>
  );
}
