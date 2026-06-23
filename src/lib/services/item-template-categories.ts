import type { ItemTemplate, ItemTemplateCategoryRecord } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { useItemTemplateStore } from "@/stores/item-template-store";
import { useItemTemplateCategoryStore } from "@/stores/item-template-category-store";
import {
  dbDeleteItemTemplateCategory,
  dbFetchItemTemplateCategories,
  dbInsertItemTemplateCategory,
  dbUpdateItemTemplateCategory,
} from "@/lib/db/write-item-template-categories";
import { updateItemTemplate } from "@/lib/services/item-templates";

export function getItemTemplateCategories(): ItemTemplateCategoryRecord[] {
  return useItemTemplateCategoryStore.getState().getSorted();
}

export async function fetchItemTemplateCategories(): Promise<ItemTemplateCategoryRecord[]> {
  if (isSupabaseConfigured()) {
    const cats = await dbFetchItemTemplateCategories();
    useItemTemplateCategoryStore.getState().hydrate(cats);
    return cats;
  }
  return getItemTemplateCategories();
}

export function getCategoryCandidatesFromTemplates(): string[] {
  const templates = useItemTemplateStore.getState().itemTemplates;
  const set = new Set<string>();
  for (const t of templates) {
    const name = (t.category ?? "").trim();
    if (name) set.add(name);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
}

export function getMergedCategoryOptions(): string[] {
  const set = new Set<string>();
  for (const c of getItemTemplateCategories()) set.add(c.name);
  for (const n of getCategoryCandidatesFromTemplates()) set.add(n);
  // その他は最後に寄せたい
  const list = Array.from(set).sort((a, b) => a.localeCompare(b, "ja"));
  const otherIdx = list.indexOf("その他");
  if (otherIdx >= 0) {
    list.splice(otherIdx, 1);
    list.push("その他");
  }
  return list;
}

export async function createItemTemplateCategory(name: string) {
  const n = name.trim();
  if (!n) return null;
  const existing = useItemTemplateCategoryStore
    .getState()
    .categories.find((c) => c.name === n);
  if (existing) return existing;

  const sortOrder =
    n === "その他"
      ? 999
      : (useItemTemplateCategoryStore.getState().categories.reduce((m, c) => Math.max(m, c.sortOrder), 0) || 0) + 1;

  if (isSupabaseConfigured()) {
    const cat = await dbInsertItemTemplateCategory({ name: n, sortOrder });
    useItemTemplateCategoryStore.getState().upsert(cat);
    return cat;
  }

  const now = new Date().toISOString();
  const local: ItemTemplateCategoryRecord = {
    id: `itc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    companyId: "mock",
    name: n,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
  useItemTemplateCategoryStore.getState().upsert(local);
  return local;
}

export async function renameItemTemplateCategory(categoryId: string, nextName: string) {
  const n = nextName.trim();
  if (!n) return null;
  const store = useItemTemplateCategoryStore.getState();
  const prev = store.categories.find((c) => c.id === categoryId);
  if (!prev) return null;
  if (prev.name === n) return prev;

  if (isSupabaseConfigured()) {
    const updated = await dbUpdateItemTemplateCategory(categoryId, { name: n });
    if (!updated) {
      throw new Error(
        "カテゴリが見つかりません。Supabase SQL Editor で supabase/add-item-template-categories.sql を実行してください。"
      );
    }
    store.upsert(updated);
  } else {
    store.setAll(
      store.categories.map((c) =>
        c.id === categoryId ? { ...c, name: n, updatedAt: new Date().toISOString() } : c
      )
    );
  }

  // テンプレ側の category（text）も揃える
  const templates = useItemTemplateStore.getState().itemTemplates;
  const targets = templates.filter((t) => t.category === prev.name);
  for (const t of targets) {
    // 既存APIを通して Supabase/モック両対応（重複ロジックを避ける）
    await updateItemTemplate(t.id, { ...pickInput(t), category: n });
  }

  return useItemTemplateCategoryStore.getState().categories.find((c) => c.id === categoryId) ?? null;
}

export async function reorderItemTemplateCategories(order: string[]) {
  const store = useItemTemplateCategoryStore.getState();
  const byId = new Map(store.categories.map((c) => [c.id, c]));
  const now = new Date().toISOString();
  const next = order
    .map((id, idx) => {
      const c = byId.get(id);
      if (!c) return null;
      const sortOrder = c.name === "その他" ? 999 : idx;
      return { ...c, sortOrder, updatedAt: now };
    })
    .filter((x): x is ItemTemplateCategoryRecord => x !== null);

  if (isSupabaseConfigured()) {
    for (const c of next) {
      await dbUpdateItemTemplateCategory(c.id, { sortOrder: c.sortOrder });
    }
  }
  store.hydrate(next);
}

export async function deleteItemTemplateCategory(
  categoryId: string,
  options: { replaceInTemplatesWithOther?: boolean } = {}
) {
  const store = useItemTemplateCategoryStore.getState();
  const cat = store.categories.find((c) => c.id === categoryId);
  if (!cat) return false;

  const templates = useItemTemplateStore.getState().itemTemplates;
  const used = templates.filter((t) => t.category === cat.name);
  if (used.length > 0 && !options.replaceInTemplatesWithOther) {
    // 呼び出し側で確認ダイアログを出す想定
    return false;
  }

  if (used.length > 0 && options.replaceInTemplatesWithOther) {
    for (const t of used) {
      await updateItemTemplate(t.id, { ...pickInput(t), category: "その他" });
    }
  }

  if (isSupabaseConfigured()) {
    await dbDeleteItemTemplateCategory(categoryId);
  }
  store.remove(categoryId);
  return true;
}

export function countTemplatesByCategoryName(name: string): number {
  return useItemTemplateStore.getState().itemTemplates.filter((t) => t.category === name).length;
}

function pickInput(t: ItemTemplate) {
  return {
    name: t.name,
    category: t.category,
    description: t.description,
    unitPrice: t.unitPrice,
    taxRate: t.taxRate,
    isFavorite: t.isFavorite,
  };
}

