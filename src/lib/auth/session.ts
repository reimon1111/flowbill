import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { clearCompanyContext } from "@/lib/db/company-context";
import { useAuthStore } from "@/stores/auth-store";

export async function signInWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email: string, password: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/** サインアップ確認メールを再送 */
export async function resendSignupConfirmation(email: string) {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
  });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  clearCompanyContext();
  useAuthStore.getState().reset();
}
