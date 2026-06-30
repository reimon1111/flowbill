/** 新規登録時の最小パスワード文字数（Supabase 設定と合わせる） */
export const MIN_PASSWORD_LENGTH = 8;

const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AUTH_USER_MESSAGES = {
  loginInvalidCredentials:
    "メールアドレスまたはパスワードが正しくありません。",
  emailRequired: "メールアドレスを入力してください。",
  emailInvalidFormat: "メールアドレスの形式が正しくありません。",
  passwordRequired: "パスワードを入力してください。",
  networkError:
    "通信エラーが発生しました。しばらくしてから再度お試しください。",
  emailNotConfirmed:
    "メールアドレスが未確認です。受信トレイの確認メールのリンクを開いてから、再度ログインしてください。",
  signupNotAllowed:
    "このメールアドレスでは登録できません。\n管理者へお問い合わせください。",
  signupAlreadyRegistered: "このメールアドレスは既に登録されています。",
  passwordTooShort: `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`,
  passwordMismatch: "確認用パスワードが一致しません。",
  validationFailed: "入力内容をご確認ください。",
  genericLoginFailed: "ログインに失敗しました。しばらくしてから再度お試しください。",
  genericSignupFailed: "登録に失敗しました。しばらくしてから再度お試しください。",
  sessionMissing: "セッションを取得できませんでした。再度お試しください。",
} as const;

type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
};

function asAuthError(error: unknown): AuthErrorLike | null {
  if (!error || typeof error !== "object") return null;
  return error as AuthErrorLike;
}

function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

function isExpectedInvitationRpcError(error: unknown): boolean {
  const authError = asAuthError(error);
  const message = normalizeText(authError?.message ?? "");

  return (
    message.includes("invitation_not_found") ||
    message.includes("invitation_expired") ||
    message.includes("invitation_already_accepted") ||
    message.includes("email_mismatch")
  );
}

const EXPECTED_INVITE_USER_MESSAGES = new Set([
  "招待が存在しません",
  "招待の有効期限が切れています",
  "すでに承認済みです",
  "招待されたメールアドレスとログイン中のメールアドレスが一致しません",
]);

function isExpectedInviteUserError(error: unknown): boolean {
  return error instanceof Error && EXPECTED_INVITE_USER_MESSAGES.has(error.message);
}

/** ユーザー向けメッセージに変換済みの想定内エラー（本番では console に出さない） */
export function isExpectedAuthError(error: unknown): boolean {
  return (
    isInvalidLoginCredentials(error) ||
    isEmailNotConfirmedError(error) ||
    isAlreadyRegistered(error) ||
    isWeakPassword(error) ||
    isSignupNotAllowedError(error) ||
    isExpectedInvitationRpcError(error) ||
    isExpectedInviteUserError(error)
  );
}

/** Error インスタンスをそのまま console.error に渡すと Next.js dev overlay が起動するため、プレーンオブジェクトにする */
function serializeAuthErrorForLog(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") {
    return { detail: String(error ?? "") };
  }
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    };
  }
  const authError = asAuthError(error);
  return {
    message: authError?.message,
    code: authError?.code,
    status: authError?.status,
    name: authError?.name,
  };
}

/** 開発者向け: 想定内の認証エラーは開発環境のみ、それ以外は本番でも記録 */
export function logAuthError(context: string, error: unknown): void {
  if (isExpectedAuthError(error) && process.env.NODE_ENV === "production") {
    return;
  }
  console.error(context, serializeAuthErrorForLog(error));
}

/** Supabase: email 未確認でログイン拒否 */
export function isEmailNotConfirmedError(error: unknown): boolean {
  const authError = asAuthError(error);
  if (!authError) return false;

  const message = normalizeText(authError.message ?? "");
  const code = normalizeText(authError.code ?? "");

  return (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed")
  );
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const msg = normalizeText(error.message);
    return msg.includes("failed to fetch") || msg.includes("network");
  }

  const authError = asAuthError(error);
  if (!authError) return false;

  const message = normalizeText(authError.message ?? "");
  const code = normalizeText(authError.code ?? "");

  return (
    authError.status === 0 ||
    code === "network_error" ||
    message.includes("failed to fetch") ||
    message.includes("network request failed") ||
    message.includes("fetch failed")
  );
}

function isInvalidLoginCredentials(error: unknown): boolean {
  const authError = asAuthError(error);
  if (!authError) return false;

  const message = normalizeText(authError.message ?? "");
  const code = normalizeText(authError.code ?? "");

  return (
    code === "invalid_credentials" ||
    code === "invalid_grant" ||
    message.includes("invalid login credentials") ||
    message.includes("invalid email or password")
  );
}

function isAlreadyRegistered(error: unknown): boolean {
  const authError = asAuthError(error);
  if (!authError) return false;

  const message = normalizeText(authError.message ?? "");
  const code = normalizeText(authError.code ?? "");

  return (
    code === "user_already_exists" ||
    code === "email_exists" ||
    (code === "signup_disabled" && message.includes("already")) ||
    message.includes("user already registered") ||
    message.includes("already been registered") ||
    message.includes("already exists")
  );
}

function isWeakPassword(error: unknown): boolean {
  const authError = asAuthError(error);
  if (!authError) return false;

  const message = normalizeText(authError.message ?? "");
  const code = normalizeText(authError.code ?? "");

  return (
    code === "weak_password" ||
    message.includes("password should be at least") ||
    message.includes("password is too short")
  );
}

function isSignupNotAllowedError(error: unknown): boolean {
  const authError = asAuthError(error);
  const message = normalizeText(
    authError?.message ?? (error instanceof Error ? error.message : String(error ?? ""))
  );
  const code = normalizeText(authError?.code ?? "");

  return (
    code === "signup_not_allowed" ||
    message.includes("signup_not_allowed") ||
    message.includes("not allowed")
  );
}

/**
 * Supabase 認証エラーをユーザー向け日本語メッセージに変換する。
 * 英語の生メッセージは返さない。
 */
export function mapAuthErrorToUserMessage(
  error: unknown,
  context: "login" | "signup" = "login"
): string {
  return toAuthUserMessage(error, context);
}

/** @see mapAuthErrorToUserMessage */
export function mapAuthErrorToMessage(
  error: unknown,
  context: "login" | "signup" = "login"
): string {
  return mapAuthErrorToUserMessage(error, context);
}

/**
 * Supabase 認証エラーをユーザー向け日本語メッセージに変換する。
 * @see mapAuthErrorToUserMessage
 */
export function toAuthUserMessage(
  error: unknown,
  context: "login" | "signup" = "login"
): string {
  if (isNetworkError(error)) {
    return AUTH_USER_MESSAGES.networkError;
  }

  if (isEmailNotConfirmedError(error)) {
    return AUTH_USER_MESSAGES.emailNotConfirmed;
  }

  if (isInvalidLoginCredentials(error)) {
    return AUTH_USER_MESSAGES.loginInvalidCredentials;
  }

  if (isAlreadyRegistered(error)) {
    return AUTH_USER_MESSAGES.signupAlreadyRegistered;
  }

  if (isWeakPassword(error)) {
    return AUTH_USER_MESSAGES.passwordTooShort;
  }

  if (isSignupNotAllowedError(error)) {
    return AUTH_USER_MESSAGES.signupNotAllowed;
  }

  if (context === "login") {
    return AUTH_USER_MESSAGES.genericLoginFailed;
  }

  return AUTH_USER_MESSAGES.genericSignupFailed;
}

/** @deprecated mapAuthErrorToUserMessage を使用してください */
export function toAuthErrorMessage(error: unknown): string {
  return toAuthUserMessage(error, "login");
}

export function isValidEmailFormat(email: string): boolean {
  return EMAIL_FORMAT_REGEX.test(email.trim());
}

export function validateLoginInput(
  email: string,
  password: string
): string | null {
  if (!email.trim()) {
    return AUTH_USER_MESSAGES.emailRequired;
  }
  if (!isValidEmailFormat(email)) {
    return AUTH_USER_MESSAGES.emailInvalidFormat;
  }
  if (!password) {
    return AUTH_USER_MESSAGES.passwordRequired;
  }
  return null;
}

export function validateSignupInput(
  email: string,
  password: string,
  confirmPassword: string
): string | null {
  if (!email.trim() || !password || !confirmPassword) {
    return AUTH_USER_MESSAGES.validationFailed;
  }
  if (!isValidEmailFormat(email)) {
    return AUTH_USER_MESSAGES.emailInvalidFormat;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return AUTH_USER_MESSAGES.passwordTooShort;
  }
  if (password !== confirmPassword) {
    return AUTH_USER_MESSAGES.passwordMismatch;
  }
  return null;
}

export type AuthActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; rawError?: unknown };

/** Supabase エラーを Result に変換（throw しない） */
export function toAuthActionFailure(
  error: unknown,
  context: "login" | "signup",
  logContext: string
): { ok: false; message: string; rawError: unknown } {
  logAuthError(logContext, error);
  return {
    ok: false,
    message: mapAuthErrorToUserMessage(error, context),
    rawError: error,
  };
}

/** テスト用: Supabase 風エラーオブジェクトを模倣 */
export function createMockAuthError(
  message: string,
  code?: string
): AuthErrorLike {
  return { message, code, name: "AuthApiError" };
}
