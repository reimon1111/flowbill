"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ProjectActionButton } from "@/components/projects/project-action-button";
import { cn } from "@/lib/utils";
import type {
  InvoiceStatus,
  ProjectActionType,
  ProjectPaymentStatus,
  ProjectStatus,
} from "@/lib/types";
import { getQuickActions } from "@/lib/project-utils";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";

type ProjectNextStepsPanelProps = {
  projectId: string;
  status: ProjectStatus;
  nextAction: string;
  invoiceStatus?: InvoiceStatus;
  paymentStatus?: ProjectPaymentStatus;
  latestQuoteId?: string;
  onAction: (action: ProjectActionType) => Promise<void>;
  loadingAction?: ProjectActionType | null;
  /** 見積をワンクリックで作って表示（任意） */
  onCreateQuoteAndOpen?: () => Promise<void>;
  creatingQuote?: boolean;
  className?: string;
  /** 一覧行などコンパクト表示 */
  variant?: "panel" | "inline";
};

export function ProjectNextStepsPanel({
  projectId,
  status,
  nextAction,
  invoiceStatus = "not_created",
  paymentStatus = "unpaid",
  latestQuoteId,
  onAction,
  loadingAction = null,
  onCreateQuoteAndOpen,
  creatingQuote,
  className,
  variant = "panel",
}: ProjectNextStepsPanelProps) {
  const canWrite = useCanWriteBusinessData();
  const quickActions = canWrite
    ? getQuickActions({ status, invoiceStatus, paymentStatus })
    : [];
  const showQuoteLink = status === "estimate";
  const hasActions =
    (showQuoteLink && (latestQuoteId || canWrite)) || quickActions.length > 0;

  if (variant === "inline") {
    return (
      <div className={cn("flex min-w-0 flex-col gap-2", className)}>
        <div className="flex min-w-0 items-start gap-1.5 text-sm text-zinc-600">
          <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-zinc-400" />
          <span className="whitespace-normal break-words">{nextAction}</span>
        </div>
        {hasActions && (
          <ProjectNextStepsButtons
            projectId={projectId}
            status={status}
            latestQuoteId={latestQuoteId}
            quickActions={quickActions}
            showQuoteLink={showQuoteLink}
            onAction={onAction}
            loadingAction={loadingAction}
            onCreateQuoteAndOpen={onCreateQuoteAndOpen}
            creatingQuote={creatingQuote}
            canWrite={canWrite}
            compact
          />
        )}
      </div>
    );
  }

  return (
    <section
      className={cn(
        "rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-5 shadow-sm shadow-zinc-900/[0.02]",
        className
      )}
    >
      <div className="flex items-start gap-2">
        <ArrowRight className="mt-0.5 size-4 shrink-0 text-zinc-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            次にやること
          </p>
          <p className="mt-1 whitespace-normal break-words text-base font-medium text-zinc-900">
            {nextAction}
          </p>
        </div>
      </div>
      {hasActions && (
        <div className="mt-4 border-t border-zinc-200/80 pt-4">
          <p className="mb-2 text-xs font-medium text-zinc-500">次のステータスへ</p>
          <ProjectNextStepsButtons
            projectId={projectId}
            status={status}
            latestQuoteId={latestQuoteId}
            quickActions={quickActions}
            showQuoteLink={showQuoteLink}
            onAction={onAction}
            loadingAction={loadingAction}
            onCreateQuoteAndOpen={onCreateQuoteAndOpen}
            creatingQuote={creatingQuote}
            canWrite={canWrite}
          />
        </div>
      )}
    </section>
  );
}

function ProjectNextStepsButtons({
  projectId,
  latestQuoteId,
  quickActions,
  showQuoteLink,
  onAction,
  loadingAction,
  onCreateQuoteAndOpen,
  creatingQuote,
  canWrite,
  compact,
}: {
  projectId: string;
  status: ProjectStatus;
  latestQuoteId?: string;
  quickActions: ReturnType<typeof getQuickActions>;
  showQuoteLink: boolean;
  onAction: (action: ProjectActionType) => Promise<void>;
  loadingAction: ProjectActionType | null;
  onCreateQuoteAndOpen?: () => Promise<void>;
  creatingQuote?: boolean;
  canWrite: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", compact && "justify-end")}>
      {showQuoteLink && (
        <>
          {latestQuoteId ? (
            <Link
              href={`/quotes/${latestQuoteId}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-8 rounded-lg"
              )}
            >
              見積書を表示
            </Link>
          ) : onCreateQuoteAndOpen && canWrite ? (
            <button
              type="button"
              onClick={() => void onCreateQuoteAndOpen()}
              disabled={!!creatingQuote}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-8 rounded-lg"
              )}
            >
              見積書を作成して表示
            </button>
          ) : canWrite ? (
            <Link
              href={`/quotes/new?projectId=${projectId}`}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-8 rounded-lg"
              )}
            >
              見積書を作成
            </Link>
          ) : null}
        </>
      )}
      {quickActions.map((a) => (
        <ProjectActionButton
          key={a.type}
          label={a.label}
          action={a.type}
          onAction={onAction}
          loading={loadingAction === a.type}
        />
      ))}
    </div>
  );
}
