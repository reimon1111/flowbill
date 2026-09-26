/**
 * 帳票連絡先（担当者名＋メール）の初期値・表示用ヘルパー。
 */

export type DocumentContactSnapshot = {
  contactName: string;
  email: string;
};

/** 帳票新規作成時の担当者名初期値（作成者の帳票用担当者名 → 会社設定） */
export function composeInitialDocumentContactName(
  creatorDocumentContactName: string | null | undefined,
  companyContactName: string | null | undefined
): string {
  const creatorPart = (creatorDocumentContactName ?? "").trim();
  if (creatorPart) return creatorPart;
  return (companyContactName ?? "").trim();
}

/** 帳票新規作成時のメール初期値（作成者の帳票用メール → 会社設定） */
export function composeInitialDocumentEmail(
  creatorDocumentEmail: string | null | undefined,
  companyEmail: string | null | undefined
): string {
  const creatorPart = (creatorDocumentEmail ?? "").trim();
  if (creatorPart) return creatorPart;
  return (companyEmail ?? "").trim();
}

/** 帳票新規作成時の担当者情報（同一ユーザーからセットで決定） */
export function composeInitialDocumentContact(
  creator: {
    documentContactName?: string | null;
    documentEmail?: string | null;
  },
  company: {
    contactName?: string | null;
    email?: string | null;
  }
): DocumentContactSnapshot {
  return {
    contactName: composeInitialDocumentContactName(
      creator.documentContactName,
      company.contactName
    ),
    email: composeInitialDocumentEmail(creator.documentEmail, company.email),
  };
}

/** 帳票表示用担当者名（保存値 → 会社設定フォールバック） */
export function resolveDocumentContactName(
  documentContactName: string | null | undefined,
  companyContactName: string | null | undefined
): string {
  const saved = (documentContactName ?? "").trim();
  if (saved) return saved;
  return (companyContactName ?? "").trim();
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
