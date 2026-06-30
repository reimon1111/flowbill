"use client";

import { create } from "zustand";
import type { CompanySettings } from "@/lib/types";
import { initialCompanySettings, emptyCompanySettings } from "@/lib/mock-company-settings";
import { initialStoreData } from "@/lib/stores/store-initial";

type CompanySettingsStore = {
  settings: CompanySettings;
  hydrate: (settings: CompanySettings) => void;
  getSettings: () => CompanySettings;
  updateSettings: (patch: Partial<Omit<CompanySettings, "id" | "createdAt">>) => CompanySettings;
  setImages: (images: {
    logoUrl?: string | null;
    stampUrl?: string | null;
    signatureUrl?: string | null;
  }) => CompanySettings;
};

export const useCompanySettingsStore = create<CompanySettingsStore>((set, get) => ({
  settings: initialStoreData(initialCompanySettings, emptyCompanySettings),

  hydrate: (settings) => set({ settings }),

  getSettings: () => get().settings,

  updateSettings: (patch) => {
    const updated: CompanySettings = {
      ...get().settings,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    set({ settings: updated });
    return updated;
  },

  setImages: (images) => {
    const updated: CompanySettings = {
      ...get().settings,
      ...images,
      updatedAt: new Date().toISOString(),
    };
    set({ settings: updated });
    return updated;
  },
}));

