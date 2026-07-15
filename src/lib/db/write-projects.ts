import type {
  ProjectHistoryEvent,
  ProjectInput,
  ProjectRecord,
  ProjectStatus,
} from "@/lib/types";
import {
  getDefaultInvoiceStatus,
  getDefaultPaymentStatus,
  getStatusAfterAction,
} from "@/lib/project-utils";
import { applyProjectMilestoneDates } from "@/lib/project-milestone-dates";
import { isMissingProjectDateColumns } from "@/lib/db/errors";
import { PROJECT_STATUS_LABELS } from "@/lib/constants";
import type { ProjectActionType } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { getAuthUserId, withCreateAudit, withUpdateAudit } from "@/lib/db/auth-user";
import { generateId } from "@/lib/db/ids";
import {
  projectFromRow,
  projectHistoryFromRow,
  projectHistoryToRow,
  projectToRow,
  type ProjectHistoryRow,
  type ProjectRow,
} from "@/lib/db/mappers";
import { recordActivityLog } from "@/lib/db/write-activity-log";
import {
  activityDescriptionCreated,
  activityDescriptionDeleted,
  activityDescriptionUpdated,
} from "@/lib/activity-log-messages";

function syncDerived(project: ProjectRecord, status: ProjectStatus): ProjectRecord {
  return applyProjectMilestoneDates(
    {
      ...project,
      status,
      invoiceStatus: getDefaultInvoiceStatus(status),
      paymentStatus: getDefaultPaymentStatus(status, project.dueDate),
      updatedAt: new Date().toISOString(),
    },
    status
  );
}

async function writeProjectRow(
  mode: "insert" | "update" | "upsert",
  companyId: string,
  project: ProjectRecord,
  id?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const userId = await getAuthUserId();
  const baseRow = projectToRow(companyId, project);
  const row =
    mode === "insert"
      ? withCreateAudit(baseRow, userId)
      : withUpdateAudit(baseRow, userId);

  const run = async (payload: ProjectRow & Record<string, unknown>) => {
    if (mode === "insert") {
      return supabase.from("projects").insert(payload);
    }
    if (mode === "update" && id) {
      return supabase
        .from("projects")
        .update(payload)
        .eq("id", id)
        .eq("company_id", companyId);
    }
    return supabase.from("projects").upsert(payload);
  };

  let { error } = await run(row);

  if (error && isMissingProjectDateColumns(error)) {
    const legacy = { ...row };
    delete legacy.confirmed_date;
    delete legacy.completed_date;
    const retry = await run(legacy);
    error = retry.error;
    if (!error) {
      console.warn(
        "projects.confirmed_date / completed_date が未作成のため、日付以外を保存しました。supabase/add-project-date-fields.sql を実行してください。"
      );
    }
  }

  if (error) throw error;
}

export async function dbInsertProject(input: ProjectInput): Promise<ProjectRecord> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const now = new Date().toISOString();
  const project: ProjectRecord = {
    id: generateId("p"),
    customerId: input.customerId,
    projectName: input.projectName,
    constructionSite: input.constructionSite ?? "",
    status: input.status,
    amount: input.amount ?? 0,
    discountLabel: input.discountLabel?.trim() ?? "",
    discountAmount: input.discountAmount ?? 0,
    customerContactName: input.customerContactName?.trim() ?? "",
    customerDepartment: input.customerDepartment?.trim() ?? "",
    customerPosition: input.customerPosition?.trim() ?? "",
    dueDate: input.dueDate,
    startDate: input.startDate ?? "",
    endDate: input.endDate ?? "",
    assigneeName: input.assigneeName ?? "",
    memo: input.memo,
    invoiceStatus: getDefaultInvoiceStatus(input.status),
    paymentStatus: getDefaultPaymentStatus(input.status, input.dueDate),
    archived: false,
    confirmedDate: "",
    completedDate: "",
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await writeProjectRow("insert", companyId, project);

  await dbInsertHistory({
    projectId: project.id,
    type: "created",
    title: "案件作成",
  });

  recordActivityLog({
    action: "created",
    targetType: "project",
    targetId: project.id,
    targetLabel: project.projectName,
    description: activityDescriptionCreated("project", project.projectName),
  });

  return project;
}

export async function dbUpdateProject(
  id: string,
  input: ProjectInput
): Promise<ProjectRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const prev = projectFromRow(data as ProjectRow);
  const updated = syncDerived(
    {
      ...prev,
      customerId: input.customerId,
      projectName: input.projectName,
      constructionSite: input.constructionSite ?? "",
      status: input.status,
      amount: input.amount ?? 0,
      discountLabel: input.discountLabel?.trim() ?? "",
      discountAmount: input.discountAmount ?? 0,
      customerContactName: input.customerContactName?.trim() ?? "",
      customerDepartment: input.customerDepartment?.trim() ?? "",
      customerPosition: input.customerPosition?.trim() ?? "",
      dueDate: input.dueDate,
      startDate: input.startDate ?? "",
      endDate: input.endDate ?? "",
      assigneeName: input.assigneeName ?? "",
      memo: input.memo,
    },
    input.status
  );

  await writeProjectRow("update", companyId, updated, id);

  await dbInsertHistory({
    projectId: id,
    type: "updated",
    title: "案件情報を更新",
  });

  recordActivityLog({
    action: "updated",
    targetType: "project",
    targetId: updated.id,
    targetLabel: updated.projectName,
    description: activityDescriptionUpdated("project", updated.projectName),
  });

  return updated;
}

export async function dbDeleteProject(id: string): Promise<boolean> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("projects")
    .select("project_name")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const projectName = String(data?.project_name ?? "");

  const { error } = await supabase
    .from("projects")
    .delete()
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;

  recordActivityLog({
    action: "deleted",
    targetType: "project",
    targetId: id,
    targetLabel: projectName,
    description: activityDescriptionDeleted("project", projectName),
  });

  return true;
}

export async function dbSetProjectArchived(
  id: string,
  archived: boolean
): Promise<ProjectRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const userId = await getAuthUserId();
  const { data, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const updated: ProjectRecord = {
    ...projectFromRow(data as ProjectRow),
    archived,
    updatedAt: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("projects")
    .update(
      withUpdateAudit(
        {
          archived,
          updated_at: updated.updatedAt,
        },
        userId
      )
    )
    .eq("id", id)
    .eq("company_id", companyId);
  if (error) throw error;

  await dbInsertHistory({
    projectId: id,
    type: "updated",
    title: archived ? "案件をアーカイブしました" : "アーカイブを解除しました",
  });

  return updated;
}

export async function dbChangeProjectStatus(
  id: string,
  status: ProjectStatus
): Promise<ProjectRecord | null> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("company_id", companyId)
    .single();
  if (fetchError || !data) return null;

  const updated = syncDerived(projectFromRow(data as ProjectRow), status);
  await writeProjectRow("update", companyId, updated, id);

  await dbInsertHistory({
    projectId: id,
    type: "status_changed",
    title: "ステータス変更",
    description: PROJECT_STATUS_LABELS[status],
  });

  return updated;
}

export async function dbExecuteProjectAction(
  id: string,
  action: ProjectActionType
): Promise<ProjectRecord | null> {
  const nextStatus = getStatusAfterAction(action);
  if (!nextStatus) return null;

  let updated = await dbChangeProjectStatus(id, nextStatus);
  if (!updated) return null;

  if (action === "mark_paid") {
    updated = {
      ...updated,
      paymentStatus: "paid",
      updatedAt: new Date().toISOString(),
    };
    await dbUpsertProject(updated);
    await dbInsertHistory({
      projectId: id,
      type: "payment_received",
      title: "入金済",
    });
  }

  return updated;
}

export async function dbUpsertProject(project: ProjectRecord): Promise<void> {
  const companyId = await resolveCompanyId();
  await writeProjectRow("upsert", companyId, project);
}

export async function dbInsertHistory(
  event: Omit<ProjectHistoryEvent, "id" | "createdAt">
): Promise<ProjectHistoryEvent> {
  const companyId = await resolveCompanyId();
  const history: ProjectHistoryEvent = {
    id: generateId("h"),
    createdAt: new Date().toISOString(),
    ...event,
  };
  const supabase = getSupabaseClient();
  const userId = await getAuthUserId();
  const { error } = await supabase
    .from("project_histories")
    .insert(withCreateAudit(projectHistoryToRow(companyId, history), userId));
  if (error) throw error;
  return history;
}

export async function dbFetchProjectHistories(
  projectId: string
): Promise<ProjectHistoryEvent[]> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("project_histories")
    .select("*")
    .eq("project_id", projectId)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ProjectHistoryRow[]).map(projectHistoryFromRow);
}
