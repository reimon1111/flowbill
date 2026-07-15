/** 見積書など帳票用：担当者名の敬称 */
export function formatContactWithSama(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("様")) return trimmed;
  return `${trimmed} 様`;
}

export type DocumentRecipientLines = {
  /** 会社名行（常に御中付き） */
  companyLine: string;
  /** 部署・役職など（空配列可） */
  orgLines: string[];
  /** 担当者名 + 様（担当者未入力時は undefined） */
  contactLine?: string;
  /** 従来互換: companyLine と同じ */
  primaryLine: string;
};

type FormatDocumentRecipientOptions = {
  department?: string;
  position?: string;
};

function withOnchu(company: string): string {
  if (!company) return "";
  return company.endsWith("御中") ? company : `${company} 御中`;
}

/**
 * 帳票の宛先表示（見積・納品・請求・領収）。
 *
 * - 担当者なし: 「会社名 御中」
 * - 担当者あり: 「会社名 御中」→ 部署 → 役職 → 「担当者名 様」
 *   （会社名の御中は消さない）
 */
export function formatDocumentRecipient(
  customerName: string,
  contactName?: string,
  options?: FormatDocumentRecipientOptions
): DocumentRecipientLines {
  const company = customerName.trim();
  const contact = contactName?.trim() ?? "";
  const department = options?.department?.trim() ?? "";
  const position = options?.position?.trim() ?? "";
  const primaryLine = withOnchu(company);

  const orgLines = [department, position].filter(Boolean);

  // 担当者未入力でも部署・役職だけある場合は表示する
  if (!contact) {
    return {
      companyLine: primaryLine,
      primaryLine,
      orgLines,
    };
  }

  const name = contact.endsWith("様")
    ? contact.slice(0, -1).trimEnd()
    : contact;

  return {
    companyLine: primaryLine,
    primaryLine,
    orgLines,
    contactLine: formatContactWithSama(name),
  };
}
