import type { ItemTemplate, ItemTemplateInput, TaxRate } from "@/lib/types";
import type { ItemTemplateFormValues } from "@/lib/validations/item-template";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  dbDeleteItemTemplate,
  dbInsertItemTemplate,
  dbToggleItemTemplateFavorite,
  dbUpdateItemTemplate,
} from "@/lib/db/write-item-templates";

export async function getItemTemplates(): Promise<ItemTemplate[]> {
  return useItemTemplateStore.getState().itemTemplates;
}

export async function getItemTemplateById(
  id: string
): Promise<ItemTemplate | null> {
  const template = useItemTemplateStore.getState().getItemTemplateById(id);
  return template ?? null;
}

export async function createItemTemplate(
  input: ItemTemplateInput
): Promise<ItemTemplate> {
  if (isSupabaseConfigured()) {
    const template = await dbInsertItemTemplate(input);
    useItemTemplateStore.getState().upsertItemTemplate(template);
    return template;
  }
  return useItemTemplateStore.getState().addItemTemplate(input);
}

export async function updateItemTemplate(
  id: string,
  input: ItemTemplateInput
): Promise<ItemTemplate | null> {
  if (isSupabaseConfigured()) {
    const template = await dbUpdateItemTemplate(id, input);
    if (template) useItemTemplateStore.getState().upsertItemTemplate(template);
    return template;
  }
  return useItemTemplateStore.getState().updateItemTemplate(id, input);
}

export async function deleteItemTemplate(id: string): Promise<boolean> {
  if (isSupabaseConfigured()) {
    const ok = await dbDeleteItemTemplate(id);
    if (ok) useItemTemplateStore.getState().removeItemTemplate(id);
    return ok;
  }
  return useItemTemplateStore.getState().deleteItemTemplate(id);
}

export async function toggleItemTemplateFavorite(
  id: string
): Promise<ItemTemplate | null> {
  if (isSupabaseConfigured()) {
    const template = await dbToggleItemTemplateFavorite(id);
    if (template) useItemTemplateStore.getState().upsertItemTemplate(template);
    return template;
  }
  return useItemTemplateStore.getState().toggleFavorite(id);
}

export function itemTemplateInputFromForm(
  values: ItemTemplateFormValues
): ItemTemplateInput {
  return {
    name: values.name.trim(),
    category: values.category,
    description: values.description.trim(),
    unitPrice: values.unitPrice,
    taxRate: values.taxRate as TaxRate,
    isFavorite: values.isFavorite,
  };
}
