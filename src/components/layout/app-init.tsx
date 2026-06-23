"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { loadAllDataFromSupabase } from "@/lib/db/load-all";
import { toDbErrorMessage } from "@/lib/db/errors";
import { syncCustomerProjectCounts } from "@/lib/services/projects";
import { useAppDataStore } from "@/stores/app-data-store";
import { dbRefreshOverdueInvoices } from "@/lib/db/write-invoices";
import { reloadInvoicesToStore, reloadProjectsToStore } from "@/lib/db/load-all";

export function AppInit() {
  const isLoading = useAppDataStore((s) => s.isLoading);
  const isReady = useAppDataStore((s) => s.isReady);
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);
  const error = useAppDataStore((s) => s.error);
  const migrationWarning = useAppDataStore((s) => s.migrationWarning);
  const supabaseEnabled = useAppDataStore((s) => s.supabaseEnabled);

  useEffect(() => {
    if (hasInitialized) return;

    let cancelled = false;

    async function init() {
      useAppDataStore.getState().setLoading(true);
      useAppDataStore.getState().setError(null);

      if (!isSupabaseConfigured()) {
        syncCustomerProjectCounts();
        if (!cancelled) {
          useAppDataStore.getState().setSupabaseEnabled(false);
          useAppDataStore.getState().setReady(true);
        }
        return;
      }

      try {
        useAppDataStore.getState().setSupabaseEnabled(true);
        await loadAllDataFromSupabase();
        await dbRefreshOverdueInvoices();
        await reloadInvoicesToStore();
        await reloadProjectsToStore();
        syncCustomerProjectCounts();
        if (!cancelled) useAppDataStore.getState().setReady(true);
      } catch (e) {
        if (!cancelled) {
          useAppDataStore.getState().setError(toDbErrorMessage(e));
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [hasInitialized]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-50/95 p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-white p-6 shadow-lg">
          <p className="font-semibold text-red-700">データの読み込みに失敗しました</p>
          <p className="mt-2 text-sm text-zinc-600">{error}</p>
          <p className="mt-3 text-xs text-zinc-500">
            新規環境: <code className="text-zinc-700">supabase/schema-full.sql</code>
            <br />
            既存環境の更新: README の「既存環境をアップデートする場合」を参照
          </p>
        </div>
      </div>
    );
  }

  const showInitialOverlay = !hasInitialized && (isLoading || !isReady);

  return (
    <>
      {showInitialOverlay && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-zinc-50/90">
          <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
          <p className="text-sm text-zinc-500">
            {supabaseEnabled ? "データを読み込んでいます..." : "準備しています..."}
          </p>
        </div>
      )}
      {migrationWarning && hasInitialized && (
        <div className="fixed inset-x-0 top-0 z-40 border-b border-amber-200 bg-amber-50 px-6 py-3 text-center text-sm text-amber-950">
          {migrationWarning}
        </div>
      )}
    </>
  );
}
