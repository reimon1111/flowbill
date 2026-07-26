/** 帳票の備考表示（未入力時は会社設定のテンプレート） */
export function resolveDocumentMemo(
  docMemo: string | null | undefined,
  template: string | null | undefined
): string {
  const trimmed = (docMemo ?? "").trim();
  if (trimmed) return trimmed;
  return (template ?? "").trim();
}

/**
 * 帳票新規作成時の備考初期値。
 * 案件備考 →（両方あるとき空行1つ）→ 会社設定テンプレート。
 * 空の部分は入れず、不要な空行も作らない。
 */
export function composeInitialDocumentMemo(
  projectDocumentMemo: string | null | undefined,
  companyTemplate: string | null | undefined
): string {
  const projectPart = (projectDocumentMemo ?? "").trim();
  const templatePart = (companyTemplate ?? "").trim();
  if (projectPart && templatePart) return `${projectPart}\n\n${templatePart}`;
  return projectPart || templatePart;
}
