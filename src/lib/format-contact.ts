import {
  DEFAULT_CUSTOMER_HONORIFIC,
  normalizeCustomerHonorific,
  type CustomerHonorific,
} from "@/lib/customer-honorific";

/** 見積書など帳票用：担当者名の敬称 */
export function formatContactWithSama(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("様")) return trimmed;
  return `${trimmed} 様`;
}

export type DocumentRecipientLines = {
  /** 会社名行（担当者なし時は敬称付き、あり時は会社名のみ） */
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
  /** 顧客宛名の敬称（担当者未入力時のみ会社名横に表示） */
  honorific?: CustomerHonorific | string | null;
};

function withHonorific(company: string, honorific: CustomerHonorific): string {
  if (!company) return "";
  if (company.endsWith("御中") || company.endsWith("様")) return company;
  return `${company}　${honorific}`;
}

/**
 * 帳票の宛先表示（見積・納品・請求・領収）。
 *
 * - 担当者なし: 「会社名　{敬称}」（敬称は案件/書類の customerHonorific）
 * - 担当者あり: 「会社名」のみ（敬称なし）→ 部署 → 役職 → 「担当者名 様」
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
  const honorific = normalizeCustomerHonorific(
    options?.honorific ?? DEFAULT_CUSTOMER_HONORIFIC
  );
  const orgLines = [department, position].filter(Boolean);

  if (!contact) {
    const companyLine = withHonorific(company, honorific);
    return {
      companyLine,
      primaryLine: companyLine,
      orgLines,
    };
  }

  const name = contact.endsWith("様")
    ? contact.slice(0, -1).trimEnd()
    : contact;

  return {
    companyLine: company,
    primaryLine: company,
    orgLines,
    contactLine: formatContactWithSama(name),
  };
}
