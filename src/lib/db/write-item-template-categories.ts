import type { ItemTemplateCategoryRecord } from "@/lib/types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { resolveCompanyId } from "@/lib/db/company-context";
import { itemTemplateCategoryFromRow, itemTemplateCategoryToRow, type ItemTemplateCategoryRow } from "@/lib/db/mappers";
import { generateId } from "@/lib/db/ids";

export async function dbFetchItemTemplateCategories(): Promise<ItemTemplateCategoryRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("item_template_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as ItemTemplateCategoryRow[]).map(itemTemplateCategoryFromRow);
}

export async function dbInsertItemTemplateCategory(
  input: Pick<ItemTemplateCategoryRecord, "name" | "sortOrder">
): Promise<ItemTemplateCategoryRecord> {
  const companyId = await resolveCompanyId();
  const now = new Date().toISOString();
  const record: ItemTemplateCategoryRecord = {
    id: generateId("itc_"),
    companyId,
    name: input.name,
    sortOrder: input.sortOrder,
    createdAt: now,
    updatedAt: now,
  };
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("item_template_categories")
    .insert(itemTemplateCategoryToRow(companyId, record));
  if (error) throw error;
  return record;
}

export async function dbUpdateItemTemplateCategory(
  id: string,
  patch: Partial<Pick<ItemTemplateCategoryRecord, "name" | "sortOrder">>
): Promise<ItemTemplateCategoryRecord | null> {
  const supabase = getSupabaseClient();
  const { data, error: fetchError } = await supabase
    .from("item_template_categories")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchError || !data) return null;

  const prev = itemTemplateCategoryFromRow(data as ItemTemplateCategoryRow);
  const updated: ItemTemplateCategoryRecord = {
    ...prev,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  const companyId = await resolveCompanyId();
  const { error } = await supabase
    .from("item_template_categories")
    .update(itemTemplateCategoryToRow(companyId, updated))
    .eq("id", id);
  if (error) throw error;
  return updated;
}

export async function dbDeleteItemTemplateCategory(id: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from("item_template_categories").delete().eq("id", id);
  if (error) throw error;
  return true;
}

