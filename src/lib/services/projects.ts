import type {
  ProjectActionType,
  ProjectHistoryEvent,
  ProjectInput,
  ProjectListItem,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/types";
import type { ProjectFormValues } from "@/lib/validations/project";
import { useProjectStore } from "@/stores/project-store";
import { useCustomerStore } from "@/stores/customer-store";
import { customerListMeta } from "@/lib/mock-customers";
import { useInvoiceStore } from "@/stores/invoice-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  ensureDraftQuoteForProject,
  syncDraftQuoteFromProject,
  updateQuoteStatus,
} from "@/lib/services/quotes";
import { sumLineItemAmounts } from "@/lib/line-item-utils";
import { useProjectItemStore } from "@/stores/project-item-store";
import { useQuoteStore } from "@/stores/quote-store";
import { useOrderStore } from "@/stores/order-store";
import { dbReplaceProjectItems } from "@/lib/db/write-project-items";
import {
  buildProjectInvoiceHref,
  resolveProjectInvoiceNavigation,
  type ProjectInvoiceNavigation,
} from "@/lib/project-invoice-actions";
import { updateInvoiceStatus } from "@/lib/services/invoices";
import {
  getProjectInvoiceState,
  isBillableInvoice,
  isInvoiceOverdue,
  isInvoiceUnpaidForAggregation,
  isIssuedBillableInvoice,
} from "@/lib/invoice-state";
import { getProjectTotalWithTax } from "@/lib/project-amount-display";
import { getActiveInvoicesForProject } from "@/lib/invoice-filters";
import {
  ensureDeliveryNoteForProject,
  ensureOrderForProject,
} from "@/lib/services/commercial-documents";
import { useAppDataStore } from "@/stores/app-data-store";
import { assertCanWriteBusinessData } from "@/lib/guards/write-access";
import {
  isMissingProjectArchivedColumn,
  DOCUMENT_MANAGEMENT_MIGRATION_HINT,
  isMissingDocumentManagementTables,
  logSupabaseError,
  PROJECT_ARCHIVED_MIGRATION_HINT,
  toUserFacingDbError,
} from "@/lib/db/errors";
import {
  dbChangeProjectStatus,
  dbDeleteProject,
  dbExecuteProjectAction,
  dbFetchProjectHistories,
  dbInsertProject,
  dbInsertHistory,
  dbSetProjectArchived,
  dbUpdateProject,
} from "@/lib/db/write-projects";

export const PROJECT_DELETE_BLOCKED_MESSAGE =
  "この案件には見積または請求履歴が存在するため削除できません。失注またはアーカイブをご利用ください。";

export function getProjectDeletionBlockReason(projectId: string): string | null {
  const quotes = useQuoteStore.getState().getQuotesByProjectId(projectId);
  if (quotes.length > 0) return PROJECT_DELETE_BLOCKED_MESSAGE;

  const invoices = getActiveInvoicesForProject(
    useInvoiceStore.getState().invoices,
    projectId
  );
  if (invoices.length > 0) return PROJECT_DELETE_BLOCKED_MESSAGE;

  const project = useProjectStore.getState().getProjectById(projectId);
  if (project?.paymentStatus === "paid") {
    return PROJECT_DELETE_BLOCKED_MESSAGE;
  }

  const histories = useProjectStore.getState().getHistories(projectId);
  if (histories.some((h) => h.type === "payment_received")) {
    return PROJECT_DELETE_BLOCKED_MESSAGE;
  }

  return null;
}

export function canDeleteProject(projectId: string): boolean {
  return getProjectDeletionBlockReason(projectId) === null;
}

export async function getProjects(): Promise<ProjectListItem[]> {
  return useProjectStore.getState().getListItems();
}

export async function getProjectById(
  id: string
): Promise<ProjectRecord | null> {
  const project = useProjectStore.getState().getProjectById(id);
  return project ?? null;
}

export async function getProjectListItem(
  id: string
): Promise<ProjectListItem | null> {
  const items = useProjectStore.getState().getListItems();
  return items.find((p) => p.id === id) ?? null;
}

export async function createProject(
  input: ProjectInput
): Promise<{ project: ProjectRecord; quoteDraftFailed: boolean }> {
  assertCanWriteBusinessData();
  // 進捗はアクションで進める。新規作成は常に見積中から開始する
  const createInput: ProjectInput = { ...input, status: "estimate" };
  let project: ProjectRecord;
  let quoteDraftFailed = false;

  if (isSupabaseConfigured()) {
    project = await dbInsertProject(createInput);
    const items = await dbReplaceProjectItems(project.id, createInput);
    useProjectItemStore.getState().hydrate([
      ...useProjectItemStore.getState().projectItems.filter(
        (i) => i.projectId !== project.id
      ),
      ...items,
    ]);
    useProjectStore.getState().upsertProject(project);
    const histories = await dbFetchProjectHistories(project.id);
    useProjectStore.getState().hydrate({
      projects: useProjectStore.getState().projects,
      histories: [
        ...histories,
        ...useProjectStore.getState().histories.filter(
          (h) => h.projectId !== project.id
        ),
      ],
    });
  } else {
    project = useProjectStore.getState().addProject(createInput);
    useProjectItemStore.getState().replaceForProject(project.id, createInput.items);
  }

  try {
    await ensureDraftQuoteForProject(project);
    await syncDraftQuoteFromProject(project);
    if (isSupabaseConfigured()) {
      const histories = await dbFetchProjectHistories(project.id);
      useProjectStore.getState().hydrate({
        projects: useProjectStore.getState().projects,
        histories: [
          ...histories,
          ...useProjectStore.getState().histories.filter(
            (h) => h.projectId !== project.id
          ),
        ],
      });
    }
  } catch (error) {
    quoteDraftFailed = true;
    logSupabaseError("ensureDraftQuoteForProject", error);
  }

  return { project, quoteDraftFailed };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ProjectRecord | null> {
  assertCanWriteBusinessData();
  const existing = useProjectStore.getState().getProjectById(id);
  // 進捗ステータスはアクション専用。フォーム更新では既存値を維持する
  const updateInput: ProjectInput = {
    ...input,
    status: existing?.status ?? input.status,
  };
  let project: ProjectRecord | null;

  if (isSupabaseConfigured()) {
    project = await dbUpdateProject(id, updateInput);
    if (project) {
      const items = await dbReplaceProjectItems(id, updateInput);
      useProjectItemStore.getState().hydrate([
        ...useProjectItemStore.getState().projectItems.filter(
          (i) => i.projectId !== id
        ),
        ...items,
      ]);
      useProjectStore.getState().upsertProject(project);
    }
  } else {
    project = useProjectStore.getState().updateProject(id, updateInput);
    if (project) {
      useProjectItemStore.getState().replaceForProject(id, updateInput.items);
    }
  }

  if (project) {
    try {
      await syncDraftQuoteFromProject(project);
    } catch {
      /* 案件保存は成功のまま */
    }
  }

  return project;
}

export async function deleteProject(
  id: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  assertCanWriteBusinessData();
  const blockReason = getProjectDeletionBlockReason(id);
  if (blockReason) {
    return { ok: false, reason: blockReason };
  }

  if (isSupabaseConfigured()) {
    const ok = await dbDeleteProject(id);
    if (ok) {
      useProjectStore.getState().removeProject(id);
      useProjectItemStore.getState().removeForProject(id);
    }
    return ok ? { ok: true } : { ok: false, reason: "案件の削除に失敗しました" };
  }

  const ok = useProjectStore.getState().deleteProject(id);
  if (ok) {
    useProjectItemStore.getState().removeForProject(id);
  }
  return ok ? { ok: true } : { ok: false, reason: "案件の削除に失敗しました" };
}

export async function setProjectArchived(
  id: string,
  archived: boolean
): Promise<ProjectRecord | null> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    try {
      const project = await dbSetProjectArchived(id, archived);
      if (project) {
        useProjectStore.getState().upsertProject(project);
        await syncProjectHistoriesToStore(id);
      }
      return project;
    } catch (error) {
      if (isMissingProjectArchivedColumn(error)) {
        useAppDataStore
          .getState()
          .setMigrationWarning(PROJECT_ARCHIVED_MIGRATION_HINT);
        return useProjectStore.getState().setProjectArchived(id, archived);
      }
      throw error;
    }
  }
  return useProjectStore.getState().setProjectArchived(id, archived);
}

export async function archiveProject(id: string): Promise<ProjectRecord | null> {
  return setProjectArchived(id, true);
}

export async function unarchiveProject(id: string): Promise<ProjectRecord | null> {
  return setProjectArchived(id, false);
}

async function syncProjectHistoriesToStore(projectId: string) {
  const histories = await dbFetchProjectHistories(projectId);
  const store = useProjectStore.getState();
  store.hydrate({
    projects: store.projects,
    histories: [
      ...histories,
      ...store.histories.filter((h) => h.projectId !== projectId),
    ],
  });
}

export async function changeProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<ProjectRecord | null> {
  if (isSupabaseConfigured()) {
    const project = await dbChangeProjectStatus(id, status);
    if (project) {
      useProjectStore.getState().upsertProject(project);
      await syncProjectHistoriesToStore(id);
    }
    return project;
  }
  return useProjectStore.getState().changeStatus(id, status);
}

export async function executeProjectAction(
  id: string,
  action: ProjectActionType
): Promise<ProjectRecord | null> {
  assertCanWriteBusinessData();
  if (isSupabaseConfigured()) {
    const project = await dbExecuteProjectAction(id, action);
    if (project) {
      useProjectStore.getState().upsertProject(project);
      await syncProjectHistoriesToStore(id);
    }
    return project;
  }
  return useProjectStore.getState().executeAction(id, action);
}

async function addProjectHistory(
  event: Omit<ProjectHistoryEvent, "id" | "createdAt">
) {
  if (isSupabaseConfigured()) {
    await dbInsertHistory(event);
    return;
  }
  useProjectStore.getState().addHistory(event);
}

async function tryAutoCreateCommercialDocument(
  label: string,
  create: () => Promise<unknown>
): Promise<void> {
  try {
    await create();
  } catch (error) {
    logSupabaseError(label, error);
    if (isMissingDocumentManagementTables(error)) {
      useAppDataStore.getState().setMigrationWarning(DOCUMENT_MANAGEMENT_MIGRATION_HINT);
      return;
    }
    throw toUserFacingDbError(error);
  }
}

/**
 * 受注確定（1クリック）
 * - 注文書の自動作成まで含めて成功扱い
 * - 案件ステータス ordered（confirmed_date 自動付与）
 * - 見積があれば最新を accepted に更新（可能な範囲で）
 * - 履歴追加
 */
export async function confirmOrderForProject(projectId: string) {
  assertCanWriteBusinessData();

  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) {
    console.error("[confirmOrderForProject] project not found", { projectId });
    throw new Error("案件が見つかりません");
  }

  // 書類管理テーブル未適用の場合、受注確定（注文書自動作成を含む）を完了させない
  if (useAppDataStore.getState().migrationWarning?.includes("add-document-management.sql")) {
    const message =
      "書類管理テーブルが未適用のため、注文書を作成できません（supabase/add-document-management.sql を実行してください）";
    console.error("[confirmOrderForProject] migration not applied", {
      projectId,
      migrationWarning: useAppDataStore.getState().migrationWarning,
    });
    throw new Error(message);
  }

  const existingOrder =
    useOrderStore
      .getState()
      .getOrdersByProjectId(projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;

  // すでに注文書がある場合は重複生成しない（deleted_at があるものは除外済み）
  let order: NonNullable<typeof existingOrder> | null = existingOrder;
  let orderCreated = false;
  if (!order) {
    // 注文書の作成に失敗したら「受注確定」扱いにしないため、先に注文書を作る
    const created = await ensureOrderForProject(projectId);
    if (!created) {
      console.error("[confirmOrderForProject] order creation returned null", {
        projectId,
      });
      throw new Error("注文書の作成に失敗しました");
    }
    order = created;
    orderCreated = true;
  }

  // 受注確定（status=ordered + confirmed_date）
  await changeProjectStatus(projectId, "ordered");

  // 見積がある場合は最新を accepted にする（rejected は維持）
  const latestQuote =
    useQuoteStore
      .getState()
      .getQuotesByProjectId(projectId)
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ??
    null;
  if (latestQuote && latestQuote.status !== "accepted" && latestQuote.status !== "rejected") {
    await updateQuoteStatus(latestQuote.id, "accepted");
  }

  await addProjectHistory({
    projectId,
    type: "status_changed",
    title: "受注確定しました",
  });
  if (orderCreated) {
    await addProjectHistory({
      projectId,
      type: "status_changed",
      title: "注文書を作成しました",
      description: order.orderNumber,
    });
  }

  return {
    project: useProjectStore.getState().getProjectById(projectId) ?? null,
    order,
    orderCreated,
    orderAlreadyExisted: Boolean(existingOrder),
  };
}

/**
 * 作業完了（ordered / in_progress から completed へ）
 */
export async function completeWorkForProject(projectId: string) {
  assertCanWriteBusinessData();
  await changeProjectStatus(projectId, "completed");
  await addProjectHistory({
    projectId,
    type: "status_changed",
    title: "作業完了しました",
  });
  await tryAutoCreateCommercialDocument("ensureDeliveryNoteForProject", () =>
    ensureDeliveryNoteForProject(projectId)
  );
  return useProjectStore.getState().getProjectById(projectId) ?? null;
}

/**
 * 請求書発行ボタン用 — DBには書き込まず遷移先だけ決める
 */
export function resolveProjectInvoiceHref(
  projectId: string,
  options?: { allowAdditional?: boolean }
): string {
  const nav = resolveProjectInvoiceNavigation(
    useInvoiceStore.getState().getInvoices(),
    projectId,
    options
  );
  return buildProjectInvoiceHref(projectId, nav);
}

export function getProjectInvoiceNavigation(
  projectId: string,
  options?: { allowAdditional?: boolean }
): ProjectInvoiceNavigation {
  return resolveProjectInvoiceNavigation(
    useInvoiceStore.getState().getInvoices(),
    projectId,
    options
  );
}

/**
 * @deprecated 即時作成は行わない。resolveProjectInvoiceHref を使用してください。
 */
export async function issueInvoiceForProject(projectId: string) {
  assertCanWriteBusinessData();
  const nav = getProjectInvoiceNavigation(projectId);
  if (nav.type === "existing") {
    return useInvoiceStore.getState().getInvoiceById(nav.invoiceId) ?? null;
  }
  return null;
}

/**
 * 入金済みにする（1クリック）
 * - 最新の請求書を paid に更新（案件の入金状態も連動）
 */
export async function markProjectPaid(projectId: string) {
  assertCanWriteBusinessData();
  const invoices = getActiveInvoicesForProject(
    useInvoiceStore.getState().getInvoices(),
    projectId
  );

  const target =
    invoices.find((i) => i.status === "sent") ??
    invoices.find((i) => i.status === "issued" || i.status === "overdue") ??
    invoices[0] ??
    null;
  if (!target) return null;

  const updated = await updateInvoiceStatus(target.id, "paid");
  await addProjectHistory({
    projectId,
    type: "payment_received",
    title: "入金済みにしました",
    description: target.invoiceNumber,
  });
  syncCustomerProjectCounts();
  return updated;
}
export async function getProjectHistory(
  projectId: string
): Promise<ProjectHistoryEvent[]> {
  if (isSupabaseConfigured()) {
    return dbFetchProjectHistories(projectId);
  }
  return useProjectStore.getState().getHistories(projectId);
}

export async function getProjectsByCustomerId(
  customerId: string
): Promise<ProjectListItem[]> {
  return useProjectStore
    .getState()
    .getListItems()
    .filter((p) => p.customerId === customerId && !p.archived);
}

export function projectInputFromForm(values: ProjectFormValues): ProjectInput {
  const items = values.items.map((it, idx) => ({
    ...it,
    sortOrder: it.sortOrder ?? idx,
  }));
  const fromItems = sumLineItemAmounts(items);
  const amount = items.length > 0 ? fromItems : (values.amount ?? 0);

  return {
    customerId: values.customerId,
    projectName: values.projectName.trim(),
    constructionSite: values.constructionSite.trim(),
    status: values.status,
    amount,
    dueDate: values.dueDate,
    startDate: values.startDate.trim(),
    endDate: values.endDate.trim(),
    assigneeName: values.assigneeName.trim(),
    memo: values.memo.trim(),
    discountLabel: values.discountLabel.trim(),
    discountAmount: values.discountAmount ?? 0,
    customerContactName: values.customerContactName.trim(),
    customerDepartment: values.customerDepartment.trim(),
    customerPosition: values.customerPosition.trim(),
    items,
  };
}

export function getDashboardStats() {
  const projects = useProjectStore
    .getState()
    .getListItems()
    .filter((p) => !p.archived);
  const invoices = useInvoiceStore.getState().getInvoices();
  const active = projects.filter(
    (p) => !["completed", "lost"].includes(p.status)
  );
  const hasInvoiceIssued = (projectId: string) =>
    invoices.some(
      (inv) => inv.projectId === projectId && isIssuedBillableInvoice(inv)
    );

  const unbilled = projects.filter(
    (p) => p.status === "completed" && !hasInvoiceIssued(p.id)
  );

  const unpaidInvoices = invoices.filter(isInvoiceUnpaidForAggregation);
  const overdueInvoices = invoices.filter((inv) => isInvoiceOverdue(inv));

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const isThisMonth = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.getFullYear() === y && d.getMonth() === m;
  };

  // draft は「請求済／今月請求額」に含めない（発行済みの有効請求のみ）
  const billedThisMonth = invoices.filter(
    (inv) => isIssuedBillableInvoice(inv) && isThisMonth(inv.issueDate)
  );
  const paidThisMonth = invoices.filter(
    (inv) =>
      isBillableInvoice(inv) &&
      inv.status === "paid" &&
      isThisMonth(inv.updatedAt.slice(0, 10))
  );

  return {
    monthlyRevenue: paidThisMonth.reduce((s, inv) => s + inv.totalAmount, 0),
    unbilledCount: unbilled.length,
    unpaidCount: unpaidInvoices.length,
    activeProjects: active.length,
    unbilledProjects: unbilled.slice(0, 5),
    unpaidProjects: projects
      .filter((p) => unpaidInvoices.some((inv) => inv.projectId === p.id))
      .slice(0, 5),
    overdueProjects: projects
      .filter((p) => overdueInvoices.some((inv) => inv.projectId === p.id))
      .slice(0, 5),
    billedThisMonth: billedThisMonth.reduce((s, inv) => s + inv.totalAmount, 0),
    paidThisMonth: paidThisMonth.reduce((s, inv) => s + inv.totalAmount, 0),
  };
}

export function syncCustomerProjectCounts() {
  const projects = useProjectStore
    .getState()
    .getListItems()
    .filter((p) => !p.archived);
  const invoices = useInvoiceStore.getState().getInvoices();
  const projectItems = useProjectItemStore.getState().projectItems;

  for (const customer of useCustomerStore.getState().customers) {
    const customerProjects = projects.filter(
      (p) => p.customerId === customer.id
    );
    const active = customerProjects.filter(
      (p) => !["completed", "lost"].includes(p.status)
    );
    const unpaid = customerProjects.filter((p) => {
      if (p.status !== "completed") return false;
      const state = getProjectInvoiceState(p.id, invoices);
      return (
        (state.invoiceStatus === "issued" || state.invoiceStatus === "sent") &&
        (state.paymentStatus === "unpaid" || state.paymentStatus === "overdue")
      );
    });
    customerListMeta[customer.id] = {
      activeProjectCount: active.length,
      unpaidAmount: unpaid.reduce(
        (s, p) =>
          s + getProjectTotalWithTax(p.id, p.amount, projectItems, p),
        0
      ),
    };
  }
}
