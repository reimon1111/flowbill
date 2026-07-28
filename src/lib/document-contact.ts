/**
 * 帳票連絡先の初期値・表示用ヘルパー。
 * 将来 documentPhone / documentFax 等も同パターンで拡張する。
 */

/** 帳票新規作成時のメール初期値（作成者の帳票用メール → 会社設定） */
export function composeInitialDocumentEmail(
  creatorDocumentEmail: string | null | undefined,
  companyEmail: string | null | undefined
): string {
  const creatorPart = (creatorDocumentEmail ?? "").trim();
  if (creatorPart) return creatorPart;
  return (companyEmail ?? "").trim();
}

/** 帳票表示用メール（保存値 → 会社設定フォールバック） */
export function resolveDocumentEmail(
  documentEmail: string | null | undefined,
  companyEmail: string | null | undefined
): string {
  const saved = (documentEmail ?? "").trim();
  if (saved) return saved;
  return (companyEmail ?? "").trim();
}
