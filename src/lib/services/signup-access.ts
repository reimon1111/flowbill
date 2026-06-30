import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AUTH_USER_MESSAGES, logAuthError } from "@/lib/auth/errors";
import { SIGNUP_NOT_ALLOWED_MESSAGE } from "@/lib/types/signup-access";

export class SignupNotAllowedError extends Error {
  constructor(message = SIGNUP_NOT_ALLOWED_MESSAGE) {
    super(message);
    this.name = "SignupNotAllowedError";
  }
}

type CheckSignupResult = {
  allowed: boolean;
  reason?: string;
  source?: string;
  company_name?: string;
};

export type SignupAllowedCheckResult =
  | { ok: true; data: CheckSignupResult }
  | { ok: false; message: string; rawError?: unknown };

export type SignupAllowedAssertResult =
  | { ok: true }
  | { ok: false; message: string };

function signupDeniedMessage(reason?: string): string {
  switch (reason) {
    case "invite_email_mismatch":
      return "招待されたメールアドレスと一致しません。招待メールと同じアドレスで登録してください。";
    case "invite_expired":
      return "この招待URLの有効期限が切れています。招待した管理者に再発行を依頼してください。";
    case "invite_already_used":
      return "この招待URLはすでに承認済みです。";
    case "invite_not_found":
      return "招待URLが無効です。招待した管理者に確認してください。";
    default:
      return AUTH_USER_MESSAGES.signupNotAllowed;
  }
}

export async function checkSignupAllowed(
  email: string,
  options?: { inviteToken?: string; allowedToken?: string }
): Promise<SignupAllowedCheckResult> {
  if (!isSupabaseConfigured()) {
    return { ok: true, data: { allowed: true, source: "local" } };
  }

  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("check_signup_allowed", {
      p_email: email.trim().toLowerCase(),
      p_invite_token: options?.inviteToken ?? null,
      p_allowed_token: options?.allowedToken ?? null,
    });

    if (error) {
      logAuthError("checkSignupAllowed", error);
      return {
        ok: false,
        message: AUTH_USER_MESSAGES.networkError,
        rawError: error,
      };
    }

    return {
      ok: true,
      data: (data ?? { allowed: false, reason: "unknown" }) as CheckSignupResult,
    };
  } catch (error) {
    logAuthError("checkSignupAllowed unexpected", error);
    return {
      ok: false,
      message: AUTH_USER_MESSAGES.networkError,
      rawError: error,
    };
  }
}

export async function assertSignupAllowed(
  email: string,
  options?: { inviteToken?: string; allowedToken?: string }
): Promise<SignupAllowedAssertResult> {
  const result = await checkSignupAllowed(email, options);

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  if (!result.data.allowed) {
    if (process.env.NODE_ENV !== "production") {
      console.debug("assertSignupAllowed denied", {
        email,
        reason: result.data.reason,
        inviteToken: options?.inviteToken,
        allowedToken: options?.allowedToken,
      });
    }
    return {
      ok: false,
      message: signupDeniedMessage(result.data.reason),
    };
  }

  return { ok: true };
}

export function buildSignupUrl(options?: {
  allowedToken?: string;
  inviteToken?: string;
}): string {
  const params = new URLSearchParams();
  if (options?.allowedToken) params.set("token", options.allowedToken);
  if (options?.inviteToken) params.set("invite", options.inviteToken);
  const q = params.toString();
  return q ? `/signup?${q}` : "/signup";
}
