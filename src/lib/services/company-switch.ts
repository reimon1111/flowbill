import { clearCompanyContext } from "@/lib/db/company-context";
import { clearAllBusinessStores } from "@/lib/stores/clear-business-stores";
import { loadAllDataFromSupabase } from "@/lib/db/load-all";
import { runBackgroundDataSync } from "@/lib/db/background-init";
import { syncCustomerProjectCounts } from "@/lib/services/projects";
import {
  fetchCompanyMembers,
  fetchPendingInvitations,
} from "@/lib/services/company-membership";
import { useAppDataStore } from "@/stores/app-data-store";
import { useCompanyMembershipStore } from "@/stores/company-membership-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function hydrateCompanyMembership() {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const [members, pendingInvitations] = await Promise.all([
    fetchCompanyMembers(),
    fetchPendingInvitations(),
  ]);

  const currentRole = members.find((m) => m.userId === user.id)?.role ?? null;

  useCompanyMembershipStore.getState().hydrate({
    companies: [],
    members,
    pendingInvitations,
    currentRole,
  });
}

export async function reloadAfterCompanyJoin() {
  clearCompanyContext();
  clearAllBusinessStores();
  useAppDataStore.getState().resetForCompanySwitch();

  await loadAllDataFromSupabase();
  syncCustomerProjectCounts();
  await hydrateCompanyMembership();
  useAppDataStore.getState().setReady(true);
  await runBackgroundDataSync();
}
