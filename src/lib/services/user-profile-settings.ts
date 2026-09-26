import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  composeInitialDocumentContact,
  type DocumentContactSnapshot,
} from "@/lib/document-contact";
import { useCompanySettingsStore } from "@/stores/company-settings-store";

export type UserDocumentContactSettings = {
  documentContactName: string;
  documentEmail: string;
};

/** ログイン中ユーザーの帳票用担当者情報（未設定は空文字） */
export async function fetchCurrentUserDocumentContact(): Promise<UserDocumentContactSettings> {
  if (!isSupabaseConfigured()) {
    return { documentContactName: "", documentEmail: "" };
  }

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { documentContactName: "", documentEmail: "" };

  const { data, error } = await supabase
    .from("profiles")
    .select("document_contact_name, document_email")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    if (isMissingProfileDocumentContactColumns(error)) {
      // 列未作成時はメールのみ後方互換で読む
      const emailOnly = await fetchCurrentUserDocumentEmailLegacy();
      return { documentContactName: "", documentEmail: emailOnly };
    }
    throw error;
  }

  return {
    documentContactName:
      data?.document_contact_name != null
        ? String(data.document_contact_name).trim()
        : "",
    documentEmail:
      data?.document_email != null ? String(data.document_email).trim() : "",
  };
}

/** @deprecated 互換用。可能な限り fetchCurrentUserDocumentContact を使う */
export async function fetchCurrentUserDocumentEmail(): Promise<string> {
  const contact = await fetchCurrentUserDocumentContact();
  return contact.documentEmail;
}

export async function updateCurrentUserDocumentContact(
  values: UserDocumentContactSettings
): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const supabase = getSupabaseBrowserClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("ログインが必要です");

  const payload: Record<string, string> = {
    document_email: values.documentEmail.trim(),
    updated_at: new Date().toISOString(),
  };
  payload.document_contact_name = values.documentContactName.trim();

  let { error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("user_id", user.id);

  if (error && isMissingProfileDocumentContactNameColumn(error)) {
    const legacy = { ...payload };
    delete legacy.document_contact_name;
    const retry = await supabase
      .from("profiles")
      .update(legacy)
      .eq("user_id", user.id);
    error = retry.error;
    if (!error) {
      console.warn(
        "profiles.document_contact_name が未作成のため、メールのみ保存しました。supabase/add-document-contact-name.sql を実行してください。"
      );
    }
  }

  if (error) throw error;
}

/** @deprecated 互換用 */
export async function updateCurrentUserDocumentEmail(
  documentEmail: string
): Promise<void> {
  const current = await fetchCurrentUserDocumentContact();
  await updateCurrentUserDocumentContact({
    documentContactName: current.documentContactName,
    documentEmail,
  });
}

/** 帳票新規作成時の担当者情報（作成者 → 会社設定、セットで決定） */
export async function resolveInitialDocumentContactForCreate(): Promise<DocumentContactSnapshot> {
  const settings = useCompanySettingsStore.getState().settings;
  const creator = await fetchCurrentUserDocumentContact();
  return composeInitialDocumentContact(creator, {
    contactName: settings.contactName ?? "",
    email: settings.email ?? "",
  });
}

/** 帳票新規作成時のメール初期値（互換用） */
export async function resolveInitialDocumentEmailForCreate(): Promise<string> {
  const contact = await resolveInitialDocumentContactForCreate();
  return contact.email;
}

async function fetchCurrentUserDocumentEmailLegacy(): Promise<string> {
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

function isMissingProfileDocumentContactNameColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as Record<string, unknown>;
  const text = [e.message, e.details, e.hint]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  if (!text.includes("document_contact_name")) return false;
  return (
    text.includes("profiles") ||
    text.includes("column") ||
    e.code === "PGRST204" ||
    e.code === "42703"
  );
}

function isMissingProfileDocumentContactColumns(error: unknown): boolean {
  return (
    isMissingProfileDocumentContactNameColumn(error) ||
    isMissingProfileDocumentEmailColumn(error)
  );
}
