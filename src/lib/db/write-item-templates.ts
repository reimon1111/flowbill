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
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("item_templates")
    .insert(withCreateAudit(itemTemplateToRow(companyId, template), userId));
  if (error) throw error;

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
  if (fetchError || !data) return null;

  const prev = itemTemplateFromRow(data as ItemTemplateRow);
  const updated: ItemTemplate = {
    ...prev,
    ...input,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("item_templates")
    .update(withUpdateAudit(itemTemplateToRow(companyId, updated), userId))
    .eq("id", id);
  if (error) throw error;

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
  if (fetchError) throw fetchError;

  const name = String(data?.name ?? "");

  const { error } = await supabase.from("item_templates").delete().eq("id", id);
  if (error) throw error;

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
  if (fetchError || !data) return null;

  const prev = itemTemplateFromRow(data as ItemTemplateRow);
  const updated: ItemTemplate = {
    ...prev,
    isFavorite: !prev.isFavorite,
    updatedBy: userId,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("item_templates")
    .update(withUpdateAudit(itemTemplateToRow(companyId, updated), userId))
    .eq("id", id);
  if (error) throw error;

  recordActivityLog({
    action: "updated",
    targetType: "item_template",
    targetId: updated.id,
    targetLabel: updated.name,
    description: activityDescriptionUpdated("item_template", updated.name),
  });

  return updated;
}
