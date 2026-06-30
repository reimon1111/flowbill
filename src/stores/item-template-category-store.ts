"use client";

import { create } from "zustand";
import type { ItemTemplateCategoryRecord } from "@/lib/types";
import { ITEM_TEMPLATE_CATEGORIES } from "@/lib/types";
import { initialStoreData } from "@/lib/stores/store-initial";

function id() {
  return `itc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function initialCategories(): ItemTemplateCategoryRecord[] {
  const now = new Date().toISOString();
  return ITEM_TEMPLATE_CATEGORIES.map((name, idx) => ({
    id: id(),
    companyId: "mock",
    name,
    sortOrder: name === "その他" ? 999 : idx,
    createdAt: now,
    updatedAt: now,
  }));
}

type ItemTemplateCategoryStore = {
  categories: ItemTemplateCategoryRecord[];
  hydrate: (categories: ItemTemplateCategoryRecord[]) => void;
  upsert: (cat: ItemTemplateCategoryRecord) => void;
  remove: (id: string) => void;
  setAll: (cats: ItemTemplateCategoryRecord[]) => void;
  getSorted: () => ItemTemplateCategoryRecord[];
};

export const useItemTemplateCategoryStore = create<ItemTemplateCategoryStore>(
  (set, get) => ({
    categories: initialStoreData(initialCategories(), []),
    hydrate: (categories) => set({ categories }),
    upsert: (cat) =>
      set((s) => ({
        categories: [
          cat,
          ...s.categories.filter((c) => c.id !== cat.id),
        ],
      })),
    remove: (id) =>
      set((s) => ({ categories: s.categories.filter((c) => c.id !== id) })),
    setAll: (cats) => set({ categories: cats }),
    getSorted: () =>
      get()
        .categories.slice()
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ja")),
  })
);

