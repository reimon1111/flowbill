"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type KeyboardEvent, type MouseEvent } from "react";
import { MoreHorizontal, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import type {
  InvoiceStatus,
  ProjectActionType,
  ProjectListItem,
  ProjectPaymentStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectStatusBadge } from "@/components/projects/project-status-badge";
import { ProjectNextStepsPanel } from "@/components/projects/project-next-steps-panel";
import { getProjectTitleHeadline } from "@/lib/project-title";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { useQuoteStore } from "@/stores/quote-store";
import { useInvoiceStore } from "@/stores/invoice-store";
import { useProjectItemStore } from "@/stores/project-item-store";
import { getProjectInvoiceState } from "@/lib/invoice-state";
import {
  BILLING_STATUS_THEME,
  getBillingStatusTheme,
  type BillingDisplayStatus,
} from "@/lib/billing-status-theme";
import { getProjectTotalWithTax } from "@/lib/project-amount-display";
import {
  getProjectQuoteSummary,
  quoteStatusLabel,
} from "@/lib/project-quotes";
import { isSimpleWorkflowMode } from "@/lib/workflow-mode";

type ProjectCardProps = {
  project: ProjectListItem;
  onAction: (projectId: string, action: ProjectActionType) => Promise<void>;
  onDelete: (project: ProjectListItem) => void;
  onArchiveToggle: (project: ProjectListItem) => void;
  variant?: "row" | "card";
};

export function ProjectCard({
  project,
  onAction,
  onDelete,
  onArchiveToggle,
  variant = "card",
}: ProjectCardProps) {
  if (variant === "row") {
    return (
      <ProjectTableRow
        project={project}
        onAction={onAction}
        onDelete={onDelete}
        onArchiveToggle={onArchiveToggle}
      />
    );
  }
  return (
    <ProjectCardMobile
      project={project}
      onAction={onAction}
      onDelete={onDelete}
      onArchiveToggle={onArchiveToggle}
    />
  );
}

function useProjectQuoteInfo(projectId: string) {
  const quotes = useQuoteStore((s) => s.quotes);
  return useMemo(
    () => getProjectQuoteSummary(projectId, quotes),
    [quotes, projectId]
  );
}

function useLatestQuoteId(projectId: string) {
  const { latestQuote } = useProjectQuoteInfo(projectId);
  return latestQuote?.id;
}

function QuoteCountHint({ projectId }: { projectId: string }) {
  const { quoteCount, latestQuote } = useProjectQuoteInfo(projectId);
  if (quoteCount <= 0) return null;
  return (
    <p className="truncate text-xs text-zinc-500">
      見積 {quoteCount}件
      {latestQuote
        ? ` · 最新 ${quoteStatusLabel(latestQuote.status)}`
        : null}
    </p>
  );
}

function useProjectDisplayAmount(project: ProjectListItem) {
  const projectItems = useProjectItemStore((s) => s.projectItems);
  return useMemo(
    () =>
      getProjectTotalWithTax(project.id, project.amount, projectItems, project),
    [project, projectItems]
  );
}

function useProjectListBilling(project: ProjectListItem) {
  const invoices = useInvoiceStore((s) => s.invoices);
  return useMemo(
    () => getProjectInvoiceState(project.id, invoices),
    [project.id, invoices]
  );
}

/** 一覧用の請求表示（draft≠未入金） */
function resolveInvoiceColumn(
  invoiceStatus: InvoiceStatus,
  paymentStatus: ProjectPaymentStatus
): { label: string; status: BillingDisplayStatus | null } {
  if (invoiceStatus === "not_created") {
    return { label: "未作成", status: "not_created" };
  }
  if (invoiceStatus === "draft") {
    return { label: "下書き", status: "draft" };
  }
  if (paymentStatus === "paid") {
    return { label: "入金済", status: "paid" };
  }
  return { label: "発行済", status: "unpaid" };
}

/** 一覧用の入金表示（draft / 未作成は —） */
function resolvePaymentColumn(
  invoiceStatus: InvoiceStatus,
  paymentStatus: ProjectPaymentStatus
): { label: string; status: BillingDisplayStatus | null } {
  if (invoiceStatus === "not_created" || invoiceStatus === "draft") {
    return { label: "—", status: null };
  }
  if (paymentStatus === "paid") {
    return { label: "入金済", status: "paid" };
  }
  if (paymentStatus === "overdue") {
    return { label: "期限超過", status: "overdue" };
  }
  return { label: "未入金", status: "unpaid" };
}

function CompactStatusBadge({
  label,
  status,
}: {
  label: string;
  status: BillingDisplayStatus | null;
}) {
  if (!status) {
    return <span className="text-sm text-zinc-400">—</span>;
  }
  const theme = getBillingStatusTheme(status);
  return (
    <span className={cn(theme.badgeClass, "whitespace-nowrap")}>{label}</span>
  );
}

function ModeOrStatusCell({ project }: { project: ProjectListItem }) {
  if (isSimpleWorkflowMode(project.workflowMode)) {
    return (
      <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
        簡易
      </span>
    );
  }
  return <ProjectStatusBadge status={project.status} />;
}

function ProjectTableRow({
  project,
  onAction,
  onDelete,
  onArchiveToggle,
}: Omit<ProjectCardProps, "variant">) {
  const router = useRouter();
  const latestQuoteId = useLatestQuoteId(project.id);
  const invoices = useInvoiceStore((s) => s.invoices);
  const displayAmount = useProjectDisplayAmount(project);
  const projectInvoiceState = useProjectListBilling(project);
  const invoiceCol = resolveInvoiceColumn(
    projectInvoiceState.invoiceStatus,
    projectInvoiceState.paymentStatus
  );
  const paymentCol = resolvePaymentColumn(
    projectInvoiceState.invoiceStatus,
    projectInvoiceState.paymentStatus
  );
  const title = getProjectTitleHeadline(project.projectName);
  const dueOverdue =
    projectInvoiceState.paymentStatus === "overdue" &&
    projectInvoiceState.invoiceStatus !== "draft" &&
    projectInvoiceState.invoiceStatus !== "not_created";

  const goDetail = () => router.push(`/projects/${project.id}`);

  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goDetail();
    }
  };

  const stopRowNav = (e: MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <tr
      className="group cursor-pointer border-b border-zinc-100 transition-colors last:border-b-0 hover:bg-zinc-50/80"
      onClick={goDetail}
      onKeyDown={onRowKeyDown}
      tabIndex={0}
    >
      <td className="min-w-[220px] max-w-[320px] px-4 py-3.5 align-middle">
        <div className="min-w-0 space-y-0.5">
          <Link
            href={`/projects/${project.id}`}
            title={title}
            onClick={stopRowNav}
            className="block truncate text-sm font-semibold text-zinc-900 hover:underline"
          >
            {title}
          </Link>
          <p className="truncate text-xs text-zinc-500" title={project.customerName}>
            {project.customerName}
          </p>
        </div>
      </td>

      <td className="whitespace-nowrap px-3 py-3.5 align-middle">
        <ModeOrStatusCell project={project} />
      </td>

      <td className="whitespace-nowrap px-3 py-3.5 text-right align-middle">
        <span className="text-sm font-medium tabular-nums text-zinc-900">
          {displayAmount > 0 ? formatCurrency(displayAmount) : "—"}
        </span>
      </td>

      <td className="whitespace-nowrap px-3 py-3.5 align-middle">
        <CompactStatusBadge label={invoiceCol.label} status={invoiceCol.status} />
      </td>

      <td className="whitespace-nowrap px-3 py-3.5 align-middle">
        <CompactStatusBadge label={paymentCol.label} status={paymentCol.status} />
      </td>

      <td className="max-w-[100px] truncate px-3 py-3.5 text-sm text-zinc-600 align-middle">
        {project.assigneeName?.trim() ? project.assigneeName : "—"}
      </td>

      <td
        className={cn(
          "whitespace-nowrap px-3 py-3.5 text-sm tabular-nums align-middle",
          dueOverdue
            ? BILLING_STATUS_THEME.overdue.textAccentClass
            : "text-zinc-600"
        )}
      >
        {project.dueDate ? formatShortDate(project.dueDate) : "—"}
      </td>

      <td
        className="min-w-[140px] max-w-[220px] px-3 py-3.5 align-middle"
        onClick={stopRowNav}
      >
        <ProjectNextStepsPanel
          projectId={project.id}
          status={project.status}
          nextAction={project.nextAction}
          invoiceStatus={projectInvoiceState.invoiceStatus}
          paymentStatus={projectInvoiceState.paymentStatus}
          latestQuoteId={latestQuoteId}
          invoices={invoices}
          onAction={(action) => onAction(project.id, action)}
          variant="inline"
        />
      </td>

      <td className="px-2 py-3.5 text-right align-middle" onClick={stopRowNav}>
        <ProjectMenu
          archived={project.archived}
          onEdit={() => router.push(`/projects/${project.id}/edit`)}
          onDelete={() => onDelete(project)}
          onArchiveToggle={() => onArchiveToggle(project)}
        />
      </td>
    </tr>
  );
}

function ProjectCardMobile({
  project,
  onAction,
  onDelete,
  onArchiveToggle,
}: Omit<ProjectCardProps, "variant">) {
  const router = useRouter();
  const latestQuoteId = useLatestQuoteId(project.id);
  const invoices = useInvoiceStore((s) => s.invoices);
  const displayAmount = useProjectDisplayAmount(project);
  const projectInvoiceState = useProjectListBilling(project);
  const invoiceCol = resolveInvoiceColumn(
    projectInvoiceState.invoiceStatus,
    projectInvoiceState.paymentStatus
  );
  const paymentCol = resolvePaymentColumn(
    projectInvoiceState.invoiceStatus,
    projectInvoiceState.paymentStatus
  );
  const title = getProjectTitleHeadline(project.projectName);

  return (
    <article className="rounded-xl border border-zinc-200/80 bg-white p-4 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/projects/${project.id}`}
            title={title}
            className="block truncate text-base font-semibold text-zinc-900 hover:underline"
          >
            {title}
          </Link>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {project.customerName}
          </p>
          <div className="mt-2">
            <QuoteCountHint projectId={project.id} />
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <ModeOrStatusCell project={project} />
            <CompactStatusBadge
              label={invoiceCol.label}
              status={invoiceCol.status}
            />
            {paymentCol.status ? (
              <CompactStatusBadge
                label={paymentCol.label}
                status={paymentCol.status}
              />
            ) : null}
          </div>
        </div>
        <ProjectMenu
          archived={project.archived}
          onEdit={() => router.push(`/projects/${project.id}/edit`)}
          onDelete={() => onDelete(project)}
          onArchiveToggle={() => onArchiveToggle(project)}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-base font-semibold tabular-nums text-zinc-900">
          {displayAmount > 0 ? formatCurrency(displayAmount) : "—"}
        </p>
        <p className="text-xs tabular-nums text-zinc-500">
          {project.dueDate
            ? `納期 ${formatShortDate(project.dueDate)}`
            : "納期 —"}
        </p>
      </div>

      {project.assigneeName?.trim() ? (
        <p className="mt-1.5 truncate text-xs text-zinc-500">
          担当 {project.assigneeName}
        </p>
      ) : null}

      <div className="mt-3 border-t border-zinc-100 pt-3">
        <ProjectNextStepsPanel
          projectId={project.id}
          status={project.status}
          nextAction={project.nextAction}
          invoiceStatus={projectInvoiceState.invoiceStatus}
          paymentStatus={projectInvoiceState.paymentStatus}
          latestQuoteId={latestQuoteId}
          invoices={invoices}
          onAction={(action) => onAction(project.id, action)}
        />
      </div>
    </article>
  );
}

function ProjectMenu({
  archived,
  onEdit,
  onDelete,
  onArchiveToggle,
}: {
  archived: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onArchiveToggle: () => void;
}) {
  const canWrite = useCanWriteBusinessData();

  if (!canWrite) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
        aria-label="メニュー"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="size-4" />
          編集
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onArchiveToggle}>
          {archived ? (
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
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
          削除
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
