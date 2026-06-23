type AuthErrorLike = {
  message?: string;
  code?: string;
  status?: number;
};

function asAuthError(error: unknown): AuthErrorLike | null {
  if (!error || typeof error !== "object") return null;
  return error as AuthErrorLike;
}

/** Supabase: email 未確認でログイン拒否 */
export function isEmailNotConfirmedError(error: unknown): boolean {
  const authError = asAuthError(error);
  if (!authError) return false;

  const message = (authError.message ?? "").toLowerCase();
  const code = (authError.code ?? "").toLowerCase();

  return (
    code === "email_not_confirmed" ||
    message.includes("email not confirmed") ||
    message.includes("email_not_confirmed")
  );
}

export function toAuthErrorMessage(error: unknown): string {
  if (isEmailNotConfirmedError(error)) {
    return "メールアドレスが未確認です。受信トレイの確認メールのリンクを開いてから、再度ログインしてください。";
  }

  const authError = asAuthError(error);
  if (authError?.message) {
    return authError.message;
  }

  return "認証エラーが発生しました";
}
