"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { MoreHorizontal, Pencil, Trash2, Archive, ArchiveRestore } from "lucide-react";
import type { ProjectActionType, ProjectListItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatCurrency, formatShortDate } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InvoiceStatusBadge,
  ProjectPaymentStatusBadge,
  ProjectStatusBadge,
} from "@/components/projects/project-status-badge";
import { ProjectNextStepsPanel } from "@/components/projects/project-next-steps-panel";
import { getProjectTitleHeadline } from "@/lib/project-title";
import { useQuoteStore } from "@/stores/quote-store";

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
      <ProjectRow
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

function useLatestQuoteId(projectId: string) {
  const quotes = useQuoteStore((s) => s.quotes);
  return useMemo(
    () =>
      quotes
        .filter((q) => q.projectId === projectId)
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0]?.id,
    [quotes, projectId]
  );
}

function ProjectRow({
  project,
  onAction,
  onDelete,
  onArchiveToggle,
}: Omit<ProjectCardProps, "variant">) {
  const router = useRouter();
  const latestQuoteId = useLatestQuoteId(project.id);

  return (
    <article
      className={cn(
        "grid items-start gap-4 rounded-xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm shadow-zinc-900/[0.02] transition-shadow hover:shadow-md hover:shadow-zinc-900/[0.04]",
        "grid-cols-[minmax(180px,1.1fr)_minmax(120px,0.9fr)_100px_88px_96px_72px_minmax(200px,1.3fr)_auto]"
      )}
    >
      <div className="min-w-0 space-y-1">
        <Link
          href={`/projects/${project.id}`}
          className="block truncate text-base font-medium text-zinc-900 hover:underline"
        >
          {getProjectTitleHeadline(project.projectName)}
        </Link>
        <p className="truncate text-sm text-zinc-500">{project.customerName}</p>
      </div>

      <div className="min-w-0">
        <ProjectStatusBadge status={project.status} />
      </div>

      <InvoiceStatusBadge status={project.invoiceStatus} />
      <ProjectPaymentStatusBadge status={project.paymentStatus} />

      <p className="text-right text-base font-medium tabular-nums text-zinc-900">
        {project.amount > 0 ? formatCurrency(project.amount) : "—"}
      </p>

      <p
        className={cn(
          "text-sm tabular-nums",
          project.paymentStatus === "overdue"
            ? "font-medium text-red-600"
            : "text-zinc-500"
        )}
      >
        {project.dueDate ? formatShortDate(project.dueDate) : "—"}
      </p>

      <ProjectNextStepsPanel
        projectId={project.id}
        status={project.status}
        nextAction={project.nextAction}
        invoiceStatus={project.invoiceStatus}
        paymentStatus={project.paymentStatus}
        latestQuoteId={latestQuoteId}
        onAction={(action) => onAction(project.id, action)}
        variant="inline"
      />

      <div className="flex items-start justify-end">
        <ProjectMenu
          archived={project.archived}
          onEdit={() => router.push(`/projects/${project.id}/edit`)}
          onDelete={() => onDelete(project)}
          onArchiveToggle={() => onArchiveToggle(project)}
        />
      </div>
    </article>
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

  return (
    <article className="rounded-xl border border-zinc-200/80 bg-white p-5 shadow-sm shadow-zinc-900/[0.02]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/projects/${project.id}`}
            className="block truncate text-lg font-semibold text-zinc-900 hover:underline"
          >
            {getProjectTitleHeadline(project.projectName)}
          </Link>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            {project.customerName}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <InvoiceStatusBadge status={project.invoiceStatus} />
            <ProjectPaymentStatusBadge status={project.paymentStatus} />
          </div>
        </div>
        <ProjectMenu
          archived={project.archived}
          onEdit={() => router.push(`/projects/${project.id}/edit`)}
          onDelete={() => onDelete(project)}
          onArchiveToggle={() => onArchiveToggle(project)}
        />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-base font-semibold tabular-nums text-zinc-900">
          {project.amount > 0 ? formatCurrency(project.amount) : "—"}
        </p>
        <p
          className={cn(
            "text-sm tabular-nums",
            project.paymentStatus === "overdue"
              ? "font-medium text-red-600"
              : "text-zinc-500"
          )}
        >
          {project.dueDate ? `納期 ${formatShortDate(project.dueDate)}` : "納期 —"}
        </p>
      </div>

      <div className="mt-4">
        <ProjectNextStepsPanel
          projectId={project.id}
          status={project.status}
          nextAction={project.nextAction}
          invoiceStatus={project.invoiceStatus}
          paymentStatus={project.paymentStatus}
          latestQuoteId={latestQuoteId}
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
