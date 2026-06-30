"use client";

import { create } from "zustand";

type AppDataStore = {
  isLoading: boolean;
  isReady: boolean;
  /** 初回データ読み込みが完了したか（2回目以降は全画面ローディングを出さない） */
  hasInitialized: boolean;
  /** loadAllDataFromSupabase 完了時の company_id */
  loadedCompanyId: string | null;
  error: string | null;
  migrationWarning: string | null;
  supabaseEnabled: boolean;
  setLoading: (loading: boolean) => void;
  setReady: (ready: boolean) => void;
  setLoadedCompanyId: (companyId: string | null) => void;
  setError: (error: string | null) => void;
  setMigrationWarning: (warning: string | null) => void;
  setSupabaseEnabled: (enabled: boolean) => void;
  resetForInit: () => void;
  resetForCompanySwitch: () => void;
};

export const useAppDataStore = create<AppDataStore>((set) => ({
  isLoading: true,
  isReady: false,
  hasInitialized: false,
  loadedCompanyId: null,
  error: null,
  migrationWarning: null,
  supabaseEnabled: false,
  setLoading: (isLoading) => set({ isLoading }),
  setReady: (isReady) =>
    set({
      isReady,
      isLoading: false,
      hasInitialized: true,
    }),
  setLoadedCompanyId: (loadedCompanyId) => set({ loadedCompanyId }),
  setError: (error) => set({ error, isLoading: false }),
  setMigrationWarning: (migrationWarning) => set({ migrationWarning }),
  setSupabaseEnabled: (supabaseEnabled) => set({ supabaseEnabled }),
  resetForInit: () =>
    set({
      isLoading: true,
      isReady: false,
      hasInitialized: false,
      loadedCompanyId: null,
      error: null,
    }),
  resetForCompanySwitch: () =>
    set({
      isLoading: true,
      isReady: false,
      hasInitialized: false,
      loadedCompanyId: null,
      error: null,
    }),
}));
