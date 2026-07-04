import type { AuthTokenResponsePassword } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import {
  type AuthActionResult,
  isStaleAuthSessionError,
  logAuthError,
  toAuthActionFailure,
} from "@/lib/auth/errors";
import { clearCompanyContext } from "@/lib/db/company-context";
import { clearAllBusinessStores } from "@/lib/stores/clear-business-stores";
import { useAppDataStore } from "@/stores/app-data-store";
import { useAuthStore } from "@/stores/auth-store";

export type SignInResult = AuthActionResult<AuthTokenResponsePassword["data"]>;
export type SignUpResult = AuthActionResult<
  Awaited<
    ReturnType<ReturnType<typeof getSupabaseBrowserClient>["auth"]["signUp"]>
  >["data"]
>;

export async function signInWithEmail(
  email: string,
  password: string
): Promise<SignInResult> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return toAuthActionFailure(error, "login", "signInWithEmail");
    }

    return { ok: true, data };
  } catch (error) {
    return toAuthActionFailure(error, "login", "signInWithEmail");
  }
}

export async function signUpWithEmail(
  email: string,
  password: string
): Promise<SignUpResult> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return toAuthActionFailure(error, "signup", "signUpWithEmail");
    }

    return { ok: true, data };
  } catch (error) {
    return toAuthActionFailure(error, "signup", "signUpWithEmail");
  }
}

/** サインアップ確認メールを再送 */
export async function resendSignupConfirmation(
  email: string
): Promise<AuthActionResult<void>> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (error) {
      return toAuthActionFailure(error, "login", "resendSignupConfirmation");
    }

    return { ok: true, data: undefined };
  } catch (error) {
    return toAuthActionFailure(error, "login", "resendSignupConfirmation");
  }
}

export async function signOut() {
  try {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      if (isStaleAuthSessionError(error)) {
        await clearStaleBrowserSession();
        return;
      }
      logAuthError("signOut", error);
    }
  } catch (error) {
    if (isStaleAuthSessionError(error)) {
      await clearStaleBrowserSession();
      return;
    }
    logAuthError("signOut unexpected", error);
    return;
  }

  resetAppAuthState();
}

export function resetAppAuthState(): void {
  clearCompanyContext();
  clearAllBusinessStores();
  useAppDataStore.getState().resetForInit();
  useAuthStore.getState().reset();
}

/** 無効な refresh token など、サーバー側セッションが既に失効している場合のローカル破棄 */
export async function clearStaleBrowserSession(): Promise<void> {
  try {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ローカル破棄のみ。失敗してもアプリ状態はリセットする
  }
  resetAppAuthState();
}
