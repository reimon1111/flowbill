/** 帳票の備考表示（未入力時は会社設定のテンプレート） */
export function resolveDocumentMemo(
  docMemo: string | null | undefined,
  template: string | null | undefined
): string {
  const trimmed = (docMemo ?? "").trim();
  if (trimmed) return trimmed;
  return (template ?? "").trim();
}
