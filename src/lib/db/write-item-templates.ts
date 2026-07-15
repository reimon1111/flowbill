import type { ItemTemplate, ItemTemplateInput } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import { getAuthUserId, withCreateAudit, withUpdateAudit } from "@/lib/db/auth-user";
import {
  itemTemplateFromRow,
  itemTemplateToRow,
  type ItemTemplateRow,
} from "@/lib/db/mappers";
import { recordActivityLog } from "@/lib/db/write-activity-log";
import {
  activityDescriptionCreated,
  activityDescriptionDeleted,
  activityDescriptionUpdated,
} from "@/lib/activity-log-messages";
import {
  isMissingAuditColumnError,
  toItemTemplateSaveError,
} from "@/lib/db/errors";

type ItemTemplateWriteRow = ItemTemplateRow & Record<string, unknown>;

function stripAuditFields(row: ItemTemplateWriteRow): ItemTemplateWriteRow {
  const next = { ...row };
  delete next.created_by;
  delete next.updated_by;
  return next;
}

async function runItemTemplateInsert(row: ItemTemplateWriteRow) {
  const supabase = getSupabaseClient();
  return supabase.from("item_templates").insert(row);
}

async function runItemTemplateUpdate(id: string, row: ItemTemplateWriteRow) {
  const supabase = getSupabaseClient();
  return supabase.from("item_templates").update(row).eq("id", id);
}

async function writeItemTemplateRow(
  mode: "insert" | "update",
  row: ItemTemplateWriteRow,
  userId: string | null,
  id?: string
): Promise<void> {
  let payload: ItemTemplateWriteRow =
    mode === "insert" ? withCreateAudit(row, userId) : withUpdateAudit(row, userId);

  let result =
    mode === "insert"
      ? await runItemTemplateInsert(payload)
      : await runItemTemplateUpdate(id!, payload);

  if (result.error && isMissingAuditColumnError(result.error)) {
    payload = stripAuditFields(payload);
    result =
      mode === "insert"
        ? await runItemTemplateInsert(payload)
        : await runItemTemplateUpdate(id!, payload);
    if (!result.error) {
      console.warn(
        "item_templates.created_by / updated_by 列が未作成のため監査列なしで保存しました。supabase/add-audit-fields.sql を適用してください。"
      );
    }
  }

  if (result.error) {
    throw toItemTemplateSaveError(result.error);
  }
}

export async function dbInsertItemTemplate(
  input: ItemTemplateInput
): Promise<ItemTemplate> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const now = new Date().toISOString();
  const template: ItemTemplate = {
    id: generateId("t"),
    ...input,
    createdBy: userId,
    updatedBy: userId,
    createdAt: now,
    updatedAt: now,
  };
  await writeItemTemplateRow(
    "insert",
    itemTemplateToRow(companyId, template),
    userId
  );

  recordActivityLog({
    action: "created",
    targetType: "item_template",
    targetId: template.id,
    targetLabel: template.name,
    description: activityDescriptionCreated("item_template", template.name),
  });

  return template;
}

export async function dbUpdateItemTemplate(
  id: string,
  input: ItemTemplateInput
): Promise<ItemTemplate | null> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("item_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw toItemTemplateSaveError(fetchError);
  if (!data) return null;

  const prev = itemTemplateFromRow(data as ItemTemplateRow);
  const updated: ItemTemplate = {
    ...prev,
    ...input,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
  await writeItemTemplateRow(
    "update",
    itemTemplateToRow(companyId, updated),
    userId,
    id
  );

  recordActivityLog({
    action: "updated",
    targetType: "item_template",
    targetId: updated.id,
    targetLabel: updated.name,
    description: activityDescriptionUpdated("item_template", updated.name),
  });

  return updated;
}

export async function dbDeleteItemTemplate(id: string): Promise<boolean> {
  const companyId = await resolveCompanyId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("item_templates")
    .select("name")
    .eq("id", id)
    .eq("company_id", companyId)
    .maybeSingle();
  if (fetchError) throw toItemTemplateSaveError(fetchError);

  const name = String(data?.name ?? "");

  const { error } = await supabase.from("item_templates").delete().eq("id", id);
  if (error) throw toItemTemplateSaveError(error);

  recordActivityLog({
    action: "deleted",
    targetType: "item_template",
    targetId: id,
    targetLabel: name,
    description: activityDescriptionDeleted("item_template", name),
  });

  return true;
}

export async function dbToggleItemTemplateFavorite(
  id: string
): Promise<ItemTemplate | null> {
  const companyId = await resolveCompanyId();
  const userId = await getAuthUserId();
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("item_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError) throw toItemTemplateSaveError(fetchError);
  if (!data) return null;

  const prev = itemTemplateFromRow(data as ItemTemplateRow);
  const updated: ItemTemplate = {
    ...prev,
    isFavorite: !prev.isFavorite,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
  await writeItemTemplateRow(
    "update",
    itemTemplateToRow(companyId, updated),
    userId,
    id
  );

  recordActivityLog({
    action: "updated",
    targetType: "item_template",
    targetId: updated.id,
    targetLabel: updated.name,
    description: activityDescriptionUpdated("item_template", updated.name),
  });

  return updated;
}
