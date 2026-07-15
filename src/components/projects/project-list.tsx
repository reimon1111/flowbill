"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, SlidersHorizontal } from "lucide-react";
import { ListToolbar, ListFilterChip } from "@/components/common/list-toolbar";
import { ListPagination } from "@/components/common/list-pagination";
import {
  buildYearFilterOptions,
  collectYearsFromDates,
  matchesYearFilter,
  paginateList,
  type YearFilterValue,
} from "@/lib/list-query";
import {
  getProjectListYearDate,
  PROJECT_SORT_DEFAULT,
  PROJECT_SORT_KEYS,
  PROJECT_SORT_OPTIONS,
  sortProjects,
  type ProjectSortKey,
} from "@/lib/list-sorts";
import { useListSort } from "@/hooks/use-list-sort";
import { useListPage } from "@/hooks/use-list-page";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteConfirmDialog } from "@/components/shared/delete-confirm-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectActionType, ProjectListItem, ProjectStatus } from "@/lib/types";
import { PROJECT_STATUS_OPTIONS } from "@/lib/project-utils";
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
import { useInvoiceStore } from "@/stores/invoice-store";
import { useCustomerStore } from "@/stores/customer-store";
import { useCanWriteBusinessData } from "@/hooks/use-can-write-business-data";
import { VIEWER_WRITE_DENIED_MESSAGE } from "@/lib/guards/write-access";
import { getProjectBillingViewHref } from "@/lib/billing-status-theme";

type StatusFilter = ProjectStatus | "all";

export function ProjectList() {
  const router = useRouter();
  const canWrite = useCanWriteBusinessData();
  useProjectStore((s) => s.projects);
  useInvoiceStore((s) => s.invoices);
  useCustomerStore((s) => s.customers);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [yearFilter, setYearFilter] = useState<YearFilterValue>("all");
  const [sort, setSort] = useListSort<ProjectSortKey>(
    "projects",
    PROJECT_SORT_DEFAULT,
    PROJECT_SORT_KEYS
  );
  const [unbilledOnly, setUnbilledOnly] = useState(false);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { page, setPage } = useListPage(
    search,
    status,
    yearFilter,
    sort,
    unbilledOnly,
    unpaidOnly,
    showArchived
  );
  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  // projects/customers の購読で再描画されるため、ここで都度計算する
  const listItems = useProjectStore.getState().getListItems();

  const yearOptions = useMemo(
    () =>
      buildYearFilterOptions(
        collectYearsFromDates(listItems.map((p) => getProjectListYearDate(p)))
      ),
    [listItems]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = listItems.filter((p) => {
      if (showArchived ? !p.archived : p.archived) return false;
      if (status !== "all" && p.status !== status) return false;
      if (
        unbilledOnly &&
        !(
          p.status === "completed" &&
          (p.invoiceStatus === "not_created" || p.invoiceStatus === "draft")
        )
      ) {
        return false;
      }
      if (
        unpaidOnly &&
        !(
          p.status === "completed" &&
          (p.invoiceStatus === "issued" || p.invoiceStatus === "sent") &&
          (p.paymentStatus === "unpaid" || p.paymentStatus === "overdue")
        )
      ) {
        return false;
      }
      if (
        !matchesYearFilter(
          p.confirmedDate || null,
          yearFilter,
          p.createdAt
        )
      ) {
        return false;
      }
      if (!q) return true;
      return (
        p.projectName.toLowerCase().includes(q) ||
        p.customerName.toLowerCase().includes(q)
      );
    });
    return sortProjects(items, sort);
  }, [
    listItems,
    search,
    status,
    yearFilter,
    sort,
    unbilledOnly,
    unpaidOnly,
    showArchived,
  ]);

  const paged = useMemo(
    () => paginateList(filtered, page),
    [filtered, page]
  );

  const activeCount = useMemo(
    () =>
      listItems.filter(
        (p) => !p.archived && !["completed", "lost"].includes(p.status)
      ).length,
    [listItems]
  );

  const handleAction = async (projectId: string, action: ProjectActionType) => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    try {
      if (action === "mark_ordered") {
        const result = await confirmOrderForProject(projectId);
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
        await completeWorkForProject(projectId);
        toast.success("作業を完了しました");
        return;
      }
      if (action === "generate_invoice") {
        router.push(resolveProjectInvoiceHref(projectId));
        return;
      }
      if (action === "view_invoice") {
        router.push(
          getProjectBillingViewHref(
            projectId,
            useInvoiceStore.getState().invoices
          )
        );
        return;
      }
      if (action === "mark_paid") {
        const updated = await markProjectPaid(projectId);
        if (!updated) {
          toast.error(PAYMENT_STATUS_UPDATE_FAILED_MESSAGE);
          return;
        }
        toast.success("入金済みにしました");
        syncCustomerProjectCounts();
        return;
      }
      syncCustomerProjectCounts();
    } catch (error) {
      console.error("project action error", { action, projectId, error });
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
    }
  };

  const handleDeleteRequest = (project: ProjectListItem) => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    const reason = getProjectDeletionBlockReason(project.id);
    if (reason) {
      toast.error(reason);
      return;
    }
    setDeleteTarget(project);
  };

  const handleArchiveToggle = async (project: ProjectListItem) => {
    if (!canWrite) {
      toast.error(VIEWER_WRITE_DENIED_MESSAGE);
      return;
    }
    try {
      const result = project.archived
        ? await unarchiveProject(project.id)
        : await archiveProject(project.id);
      if (!result) {
        toast.error("案件が見つかりません");
        return;
      }
      toast.success(
        project.archived ? "アーカイブを解除しました" : "案件をアーカイブしました"
      );
      syncCustomerProjectCounts();
    } catch (error) {
      toast.error(formatSupabaseError(error));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteProject(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      syncCustomerProjectCounts();
      toast.success("案件を削除しました");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto min-w-0 max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <PageHeader
        title="案件"
        description={`進行中 ${activeCount}件 — 次にやることが一目でわかります`}
        action={
          canWrite ? (
            <Link
              href="/projects/new"
              className={cn(
                buttonVariants({ size: "lg" }),
                "h-10 gap-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
              )}
            >
              <Plus className="size-4" strokeWidth={1.5} />
              新規案件
            </Link>
          ) : undefined
        }
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="案件名・顧客名で検索..."
        yearFilter={yearFilter}
        yearOptions={yearOptions}
        onYearFilterChange={setYearFilter}
        sort={sort}
        sortOptions={PROJECT_SORT_OPTIONS}
        onSortChange={setSort}
        statusFilters={
          <>
            <SlidersHorizontal className="size-4 shrink-0 text-zinc-400" strokeWidth={1.5} />
            <ListFilterChip active={status === "all"} onClick={() => setStatus("all")}>
              すべて
            </ListFilterChip>
            {PROJECT_STATUS_OPTIONS.map((opt) => (
              <ListFilterChip
                key={opt.value}
                active={status === opt.value}
                onClick={() => setStatus(opt.value)}
              >
                {opt.label}
                <span className="ml-1.5 text-zinc-400">
                  (
                  {listItems.filter(
                    (p) =>
                      p.status === opt.value &&
                      (showArchived ? p.archived : !p.archived)
                  ).length}
                  )
                </span>
              </ListFilterChip>
            ))}
          </>
        }
        extraFilters={
          <>
            <ListFilterChip
              active={unbilledOnly}
              onClick={() => setUnbilledOnly((v) => !v)}
            >
              未請求のみ
            </ListFilterChip>
            <ListFilterChip
              active={unpaidOnly}
              onClick={() => setUnpaidOnly((v) => !v)}
            >
              未入金のみ
            </ListFilterChip>
            <ListFilterChip
              active={showArchived}
              onClick={() => setShowArchived((v) => !v)}
            >
              アーカイブを表示
            </ListFilterChip>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          title={
            search ||
              status !== "all" ||
              yearFilter !== "all" ||
              unbilledOnly ||
              unpaidOnly ||
              showArchived
              ? "該当する案件が見つかりません"
              : "案件がまだ登録されていません"
          }
          description={
            search ||
              status !== "all" ||
              yearFilter !== "all" ||
              unbilledOnly ||
              unpaidOnly ||
              showArchived
              ? "検索・絞り込み条件を変えてお試しください"
              : "案件を進めるだけで、請求漏れ・入金漏れをなくすための中心画面です"
          }
          action={
            !(
              search ||
              status !== "all" ||
              yearFilter !== "all" ||
              unbilledOnly ||
              unpaidOnly ||
              showArchived
            ) && (
              <Link
                href="/projects/new"
                className={cn(
                  buttonVariants(),
                  "rounded-xl bg-zinc-900 text-white hover:bg-zinc-800"
                )}
              >
                <Plus className="size-4" />
                最初の案件を作成
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="hidden lg:block">
            <div className="mb-2 grid grid-cols-[minmax(180px,1.1fr)_minmax(120px,0.9fr)_108px_96px_72px_minmax(200px,1.3fr)_auto] gap-4 px-5 text-xs font-medium uppercase tracking-wider text-zinc-400">
              <span>案件 / 顧客</span>
              <span>ステータス</span>
              <span>請求・入金</span>
              <span className="text-right">金額</span>
              <span>納期</span>
              <span>次にやること</span>
              <span />
            </div>
            <div className="space-y-2">
              {paged.items.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  variant="row"
                  onAction={handleAction}
                  onDelete={handleDeleteRequest}
                  onArchiveToggle={handleArchiveToggle}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {paged.items.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                variant="card"
                onAction={handleAction}
                onDelete={handleDeleteRequest}
                onArchiveToggle={handleArchiveToggle}
              />
            ))}
          </div>

          <ListPagination
            page={paged.page}
            totalPages={paged.totalPages}
            totalCount={paged.totalCount}
            onPageChange={setPage}
          />
        </>
      )}

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="案件を削除しますか？"
        description={`「${deleteTarget?.projectName}」を削除します。この操作は取り消せません。`}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </div>
  );
}

