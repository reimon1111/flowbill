import { reloadInvoicesToStore, reloadProjectsToStore } from "@/lib/db/load-all";
import { dbRefreshOverdueInvoices } from "@/lib/db/write-invoices";
import { loadRecentActivityLogsToStore } from "@/lib/services/activity-log";
import { syncCustomerProjectCounts } from "@/lib/services/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** 画面表示後に実行する同期処理（期限超過更新・操作履歴など） */
export async function runBackgroundDataSync(): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const changed = await dbRefreshOverdueInvoices();
  if (changed) {
    await Promise.all([reloadInvoicesToStore(), reloadProjectsToStore()]);
    syncCustomerProjectCounts();
  }

  await loadRecentActivityLogsToStore(10);
}
