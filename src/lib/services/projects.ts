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
import { dbReplaceProjectItems } from "@/lib/db/write-project-items";
import { todayISO, addDaysToDate } from "@/lib/quote-dates";
import { createInvoice, createInvoiceFromQuote, updateInvoiceStatus } from "@/lib/services/invoices";
import {
  ensureDeliveryNoteForProject,
  ensureOrderForProject,
  ensureReceiptForInvoice,
} from "@/lib/services/commercial-documents";
import { useCompanySettingsStore } from "@/stores/company-settings-store";
import { DEFAULT_UNIT } from "@/lib/constants/units";
import { useAppDataStore } from "@/stores/app-data-store";
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

  const invoices = useInvoiceStore.getState().getInvoicesByProjectId(projectId);
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
  let project: ProjectRecord;
  let quoteDraftFailed = false;

  if (isSupabaseConfigured()) {
    project = await dbInsertProject(input);
    const items = await dbReplaceProjectItems(project.id, input);
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
    project = useProjectStore.getState().addProject(input);
    useProjectItemStore.getState().replaceForProject(project.id, input.items);
  }

  if (input.status === "estimate") {
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
  }

  return { project, quoteDraftFailed };
}

export async function updateProject(
  id: string,
  input: ProjectInput
): Promise<ProjectRecord | null> {
  let project: ProjectRecord | null;

  if (isSupabaseConfigured()) {
    project = await dbUpdateProject(id, input);
    if (project) {
      const items = await dbReplaceProjectItems(id, input);
      useProjectItemStore.getState().hydrate([
        ...useProjectItemStore.getState().projectItems.filter(
          (i) => i.projectId !== id
        ),
        ...items,
      ]);
      useProjectStore.getState().upsertProject(project);
    }
  } else {
    project = useProjectStore.getState().updateProject(id, input);
    if (project) {
      useProjectItemStore.getState().replaceForProject(id, input.items);
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
 * - 案件ステータス ordered
 * - 可能なら見積を accepted 扱い
 * - 履歴追加
 */
export async function confirmOrderForProject(projectId: string) {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return null;

  // 見積がある場合は最新を accepted にして、案件も ordered に揃える
  const candidates = useQuoteStore
    .getState()
    .getQuotesByProjectId(projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const latest = candidates[0] ?? null;
  if (latest && latest.status !== "accepted" && latest.status !== "rejected") {
    await updateQuoteStatus(latest.id, "accepted");
  } else {
    await changeProjectStatus(projectId, "ordered");
  }

  await addProjectHistory({
    projectId,
    type: "status_changed",
    title: "受注確定しました",
  });
  await tryAutoCreateCommercialDocument("ensureOrderForProject", () =>
    ensureOrderForProject(projectId)
  );
  return useProjectStore.getState().getProjectById(projectId) ?? null;
}

/**
 * 作業完了（ordered / in_progress から completed へ）
 */
export async function completeWorkForProject(projectId: string) {
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
 * 請求書発行（1クリック）
 * - 優先: accepted 見積 → sent 見積 → 案件明細
 * - 請求書を作成して issued にする
 * - 案件 invoiceStatus も連動更新（updateInvoiceStatus 側で実施）
 */
export async function issueInvoiceForProject(projectId: string) {
  const project = useProjectStore.getState().getProjectById(projectId);
  if (!project) return null;

  const issueDate = todayISO();
  const dueDate = project.dueDate || addDaysToDate(issueDate, 14);

  const fromQuote = await createInvoiceFromQuote(projectId, issueDate, dueDate);
  let invoice = fromQuote?.invoice ?? null;

  if (!invoice) {
    const projectItems = useProjectItemStore.getState().getByProjectId(projectId);
    if (projectItems.length === 0) return null;

    const settings = useCompanySettingsStore.getState().settings;
    invoice = await createInvoice({
      projectId,
      customerId: project.customerId,
      quoteId: "",
      issueDate,
      dueDate,
      paymentTerms: settings.paymentTerms ?? "",
      bankAccountId: null,
      memo: settings.invoiceMemoTemplate ?? "",
      items: projectItems.map((it, idx) => ({
        quoteItemId: null,
        name: it.name,
        description: it.description,
        width: it.width ?? "",
        height: it.height ?? "",
        quantity: it.quantity,
        unit: it.unit || DEFAULT_UNIT,
        unitPrice: it.unitPrice,
        taxRate: it.taxRate,
        sortOrder: it.sortOrder ?? idx,
      })),
    });
  }

  const issued = await updateInvoiceStatus(invoice.id, "issued");
  await addProjectHistory({
    projectId,
    type: "invoice_generated",
    title: "請求書を発行しました",
    description: invoice.invoiceNumber,
  });

  const result = issued ?? invoice;
  if (result) {
    await tryAutoCreateCommercialDocument("ensureReceiptForInvoice", () =>
      ensureReceiptForInvoice(result.id)
    );
  }
  return result;
}

/**
 * 入金済みにする（1クリック）
 * - 最新の請求書を paid に更新（案件の入金状態も連動）
 */
export async function markProjectPaid(projectId: string) {
  const invoices = useInvoiceStore
    .getState()
    .getInvoicesByProjectId(projectId)
    .slice()
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

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
      (inv) =>
        inv.projectId === projectId &&
        ["issued", "sent", "paid", "overdue"].includes(inv.status)
    );

  const unbilled = projects.filter(
    (p) => p.status === "completed" && !hasInvoiceIssued(p.id)
  );

  const unpaidInvoices = invoices.filter(
    (inv) => ["issued", "sent", "overdue"].includes(inv.status)
  );
  const overdueInvoices = unpaidInvoices.filter((inv) => {
    const due = new Date(inv.dueDate + "T23:59:59");
    return due < new Date();
  });

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const isThisMonth = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d.getFullYear() === y && d.getMonth() === m;
  };

  const billedThisMonth = invoices.filter(
    (inv) => inv.status !== "cancelled" && isThisMonth(inv.issueDate)
  );
  const paidThisMonth = invoices.filter(
    (inv) => inv.status === "paid" && isThisMonth(inv.updatedAt.slice(0, 10))
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

  for (const customer of useCustomerStore.getState().customers) {
    const customerProjects = projects.filter(
      (p) => p.customerId === customer.id
    );
    const active = customerProjects.filter(
      (p) => !["completed", "lost"].includes(p.status)
    );
    const unpaid = customerProjects.filter(
      (p) =>
        p.status === "completed" &&
        (p.invoiceStatus === "issued" || p.invoiceStatus === "sent") &&
        (p.paymentStatus === "unpaid" || p.paymentStatus === "overdue")
    );
    customerListMeta[customer.id] = {
      activeProjectCount: active.length,
      unpaidAmount: unpaid.reduce((s, p) => s + p.amount, 0),
    };
  }
}
