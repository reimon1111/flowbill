/** react-hook-form / Zod 4 の FieldError.message を表示用文字列に変換 */
export function formatFieldErrorMessage(message: unknown): string {
  if (message == null || message === "") return "";
  if (typeof message === "string") return message;
  if (typeof message === "number" || typeof message === "boolean") {
    return String(message);
  }
  if (typeof message === "object") {
    if ("message" in message) {
      const inner = (message as { message: unknown }).message;
      if (typeof inner === "string") return inner;
      if (inner != null) return formatFieldErrorMessage(inner);
    }
  }
  return "入力内容を確認してください";
}

function collectFieldMessages(value: unknown, out: string[]): void {
  if (value == null) return;
  if (typeof value === "object" && "message" in value) {
    const msg = formatFieldErrorMessage((value as { message: unknown }).message);
    if (msg) out.push(msg);
  }
  if (Array.isArray(value)) {
    for (const item of value) collectFieldMessages(item, out);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectFieldMessages(v, out);
    }
  }
}

/** フォームの最初のエラーメッセージ（ネストした items 配列にも対応） */
export function firstFormErrorMessage(
  errors: Record<string, unknown>
): string {
  const messages: string[] = [];
  collectFieldMessages(errors, messages);
  return messages[0] ?? "入力内容を確認してください";
}
