import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { composeInitialDocumentEmail } from "@/lib/document-contact";
import { useCompanySettingsStore } from "@/stores/company-settings-store";

/** ログイン中ユーザーの profiles.document_email（未設定は空文字） */
export async function fetchCurrentUserDocumentEmail(): Promise<string> {
  if (!isSupabaseConfigured()) return "";

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const { data, error } = await supabase
    .from("profiles")
    .select("document_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingProfileDocumentEmailColumn(error)) return "";
    throw error;
  }

  return data?.document_email != null ? String(data.document_email).trim() : "";
}

export async function updateCurrentUserDocumentEmail(
  documentEmail: string
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const { error } = await supabase
    .from("profiles")
    .update({
      document_email: documentEmail.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) throw error;
}

/** 帳票新規作成時のメール初期値（作成者 → 会社設定） */
export async function resolveInitialDocumentEmailForCreate(): Promise<string> {
  const companyEmail =
    useCompanySettingsStore.getState().settings.email ?? "";
  const creatorEmail = await fetchCurrentUserDocumentEmail();
  return composeInitialDocumentEmail(creatorEmail, companyEmail);
}

function isMissingProfileDocumentEmailColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const text = [e.message, e.details, e.hint]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  if (!text.includes("document_email")) return false;
  return (
    text.includes("profiles") ||
    text.includes("column") ||
    e.code === "PGRST204" ||
    e.code === "42703"
  );
}
