"use client";

import { Loader2 } from "lucide-react";
import { useAppDataStore } from "@/stores/app-data-store";
import { getCachedCompanyId } from "@/lib/db/company-context";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AppLoadingScreen({ message }: { message?: string }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-zinc-50/30">
      <Loader2 className="size-8 animate-spin text-zinc-400" strokeWidth={1.5} />
      {message ? <p className="text-sm text-zinc-500">{message}</p> : null}
    </div>
  );
}

/**
 * 認証・company_id・データロードが完了するまで子を描画しない。
 * 古いストアデータのちらつきを防ぐ。
 */
export function DataReadyGate({ children }: { children: React.ReactNode }) {
  const hasInitialized = useAppDataStore((s) => s.hasInitialized);
  const isReady = useAppDataStore((s) => s.isReady);
  const loadedCompanyId = useAppDataStore((s) => s.loadedCompanyId);
  const supabaseEnabled = isSupabaseConfigured();

  const companyMatches =
    !supabaseEnabled ||
    (loadedCompanyId !== null && loadedCompanyId === getCachedCompanyId());

  const dataReady = hasInitialized && isReady && companyMatches;

  if (!dataReady) {
    return (
      <AppLoadingScreen
        message={supabaseEnabled ? "データを読み込んでいます..." : "準備しています..."}
      />
    );
  }

  return <>{children}</>;
}
