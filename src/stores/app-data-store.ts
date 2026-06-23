"use client";

import { create } from "zustand";

type AppDataStore = {
  isLoading: boolean;
  isReady: boolean;
  /** 初回データ読み込みが完了したか（2回目以降は全画面ローディングを出さない） */
  hasInitialized: boolean;
  error: string | null;
  migrationWarning: string | null;
  supabaseEnabled: boolean;
  setLoading: (loading: boolean) => void;
  setReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
  setMigrationWarning: (warning: string | null) => void;
  setSupabaseEnabled: (enabled: boolean) => void;
};

export const useAppDataStore = create<AppDataStore>((set) => ({
  isLoading: true,
  isReady: false,
  hasInitialized: false,
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
  setError: (error) => set({ error, isLoading: false }),
  setMigrationWarning: (migrationWarning) => set({ migrationWarning }),
  setSupabaseEnabled: (supabaseEnabled) => set({ supabaseEnabled }),
}));
