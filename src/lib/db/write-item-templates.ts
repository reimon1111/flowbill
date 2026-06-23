import type { ItemTemplate, ItemTemplateInput } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { generateId } from "@/lib/db/ids";
import {
  itemTemplateFromRow,
  itemTemplateToRow,
  type ItemTemplateRow,
} from "@/lib/db/mappers";

export async function dbInsertItemTemplate(
  input: ItemTemplateInput
): Promise<ItemTemplate> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const template: ItemTemplate = {
    id: generateId("t"),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("item_templates")
    .insert(itemTemplateToRow(companyId, template));
  if (error) throw error;
  return template;
}

export async function dbUpdateItemTemplate(
  id: string,
  input: ItemTemplateInput
): Promise<ItemTemplate | null> {
  const companyId = await resolveCompanyId();
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
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("item_templates")
    .update(itemTemplateToRow(companyId, updated))
    .eq("id", id);
  if (error) throw error;
  return updated;
}

export async function dbDeleteItemTemplate(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("item_templates").delete().eq("id", id);
  if (error) throw error;
  return true;
}

export async function dbToggleItemTemplateFavorite(
  id: string
): Promise<ItemTemplate | null> {
  const companyId = await resolveCompanyId();
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
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("item_templates")
    .update(itemTemplateToRow(companyId, updated))
    .eq("id", id);
  if (error) throw error;
  return updated;
}
