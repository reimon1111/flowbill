import { create } from "zustand";
import type { ItemTemplate, ItemTemplateInput } from "@/lib/types";
import { initialItemTemplates } from "@/lib/mock-item-templates";
import { initialStoreData } from "@/lib/stores/store-initial";

function generateId(): string {
  return `t${Date.now().toString(36)}`;
}

type ItemTemplateStore = {
  itemTemplates: ItemTemplate[];
  hydrate: (itemTemplates: ItemTemplate[]) => void;
  upsertItemTemplate: (template: ItemTemplate) => void;
  removeItemTemplate: (id: string) => void;
  addItemTemplate: (input: ItemTemplateInput) => ItemTemplate;
  updateItemTemplate: (
    id: string,
    input: ItemTemplateInput
  ) => ItemTemplate | null;
  deleteItemTemplate: (id: string) => boolean;
  toggleFavorite: (id: string) => ItemTemplate | null;
  getItemTemplateById: (id: string) => ItemTemplate | undefined;
};

export const useItemTemplateStore = create<ItemTemplateStore>((set, get) => ({
  itemTemplates: initialStoreData(initialItemTemplates, []),

  hydrate: (itemTemplates) => set({ itemTemplates }),

  upsertItemTemplate: (template) =>
    set((state) => {
      const exists = state.itemTemplates.some((t) => t.id === template.id);
      if (exists) {
        return {
          itemTemplates: state.itemTemplates.map((t) =>
            t.id === template.id ? template : t
          ),
        };
      }
      return { itemTemplates: [template, ...state.itemTemplates] };
    }),

  removeItemTemplate: (id) =>
    set((state) => ({
      itemTemplates: state.itemTemplates.filter((t) => t.id !== id),
    })),

  addItemTemplate: (input) => {
    const now = new Date().toISOString();
    const template: ItemTemplate = {
      id: generateId(),
      ...input,
      createdBy: null,
      updatedBy: null,
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({
      itemTemplates: [template, ...state.itemTemplates],
    }));
    return template;
  },

  updateItemTemplate: (id, input) => {
    let updated: ItemTemplate | null = null;
    set((state) => ({
      itemTemplates: state.itemTemplates.map((t) => {
        if (t.id !== id) return t;
        updated = {
          ...t,
          ...input,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    }));
    return updated;
  },

  deleteItemTemplate: (id) => {
    const exists = get().itemTemplates.some((t) => t.id === id);
    if (!exists) return false;
    set((state) => ({
      itemTemplates: state.itemTemplates.filter((t) => t.id !== id),
    }));
    return true;
  },

  toggleFavorite: (id) => {
    let updated: ItemTemplate | null = null;
    set((state) => ({
      itemTemplates: state.itemTemplates.map((t) => {
        if (t.id !== id) return t;
        updated = {
          ...t,
          isFavorite: !t.isFavorite,
          updatedAt: new Date().toISOString(),
        };
        return updated;
      }),
    }));
    return updated;
  },

  getItemTemplateById: (id) =>
    get().itemTemplates.find((t) => t.id === id),
}));
