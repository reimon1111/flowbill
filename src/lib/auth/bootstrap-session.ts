import type { Session, User } from "@supabase/supabase-js";
import { ensureUserProfileAndCompany } from "@/lib/auth/ensure-profile";
import { clearCompanyContext, resolveCompanyId } from "@/lib/db/company-context";
import { formatSupabaseError, logSupabaseError } from "@/lib/db/errors";
import { hydrateCompanyMembership } from "@/lib/services/company-switch";
import { useAuthStore } from "@/stores/auth-store";

export function isUserAlreadyBootstrapped(userId: string): boolean {
  const state = useAuthStore.getState();
  return (
    state.bootstrappedUserId === userId &&
    state.isAuthenticated &&
    state.user?.id === userId
  );
}

/** ログイン済みセッションをアプリ用に初期化（profile + company） */
export async function bootstrapAuthenticatedSession(
  user: User,
  session?: Session | null
): Promise<string> {
  if (isUserAlreadyBootstrapped(user.id)) {
    return useAuthStore.getState().bootstrappedUserId ?? user.id;
  }

  try {
    clearCompanyContext();
    await ensureUserProfileAndCompany(user, session);
    const companyId = await resolveCompanyId();
    try {
      await hydrateCompanyMembership();
    } catch (membershipError) {
      logSupabaseError("hydrateCompanyMembership", membershipError);
    }
    useAuthStore.getState().setProfileError(null);
    useAuthStore.getState().setBootstrappedUserId(user.id);
    useAuthStore.getState().setUser(user);
    return companyId;
  } catch (error) {
    const message = formatSupabaseError(error);
    logSupabaseError("ensureProfile error", error);
    useAuthStore.getState().setProfileError(message);
    useAuthStore.getState().setLoading(false);
    throw error;
  }
}

export function logSessionCheck(session: Session | null) {
  void session;
}
