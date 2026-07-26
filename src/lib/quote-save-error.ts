import { VIEWER_WRITE_DENIED_MESSAGE } from "@/lib/guards/write-access";

export const QUOTE_SAVE_FAILED_TITLE = "見積書を保存できませんでした";
export const QUOTE_SAVE_FAILED_DESCRIPTION =
  "入力内容またはシステム設定を確認し、もう一度お試しください。";
export const QUOTE_VALIDATION_FAILED_TITLE = "入力内容を確認してください";
export const QUOTE_VALIDATION_FAILED_DESCRIPTION =
  "未入力または正しく入力されていない項目があります。";
export const QUOTE_SAVE_PERMISSION_DENIED =
  "この見積書を編集する権限がありません。";
export const QUOTE_SAVE_SYSTEM_ERROR_DESCRIPTION =
  "見積書の保存中にエラーが発生しました。時間をおいて再度お試しください。";

/** 個人情報・明細を含まない安全なログ用コンテキスト */
export type QuoteSaveErrorContext = {
  quoteId: string;
  projectId?: string;
  companyId?: string | null;
};

function readErrorShape(error: unknown): {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} {
  if (!error || typeof error !== "object") return {};
  const e = error as Record<string, unknown>;
  return {
    code: typeof e.code === "string" ? e.code : undefined,
    message: typeof e.message === "string" ? e.message : undefined,
    details: typeof e.details === "string" ? e.details : undefined,
    hint: typeof e.hint === "string" ? e.hint : undefined,
  };
}

export function isQuoteWritePermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message === VIEWER_WRITE_DENIED_MESSAGE ||
    error.message === QUOTE_SAVE_PERMISSION_DENIED
  );
}

/** ユーザー向け toast の description（内部エラー全文は出さない） */
export function quoteSaveErrorToastDescription(error: unknown): string {
  if (isQuoteWritePermissionError(error)) {
    return QUOTE_SAVE_PERMISSION_DENIED;
  }
  return QUOTE_SAVE_SYSTEM_ERROR_DESCRIPTION;
}

export function logQuoteSaveError(
  label: string,
  error: unknown,
  context: QuoteSaveErrorContext
): void {
  const shape = readErrorShape(error);
  console.error(label, {
    quoteId: context.quoteId,
    projectId: context.projectId ?? null,
    companyId: context.companyId ?? null,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : (shape.message ?? null),
    errorCode: shape.code ?? null,
    errorDetails: shape.details ?? null,
    errorHint: shape.hint ?? null,
  });
}
