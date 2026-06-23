/** 見積書など帳票用：担当者名の敬称 */
export function formatContactWithSama(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith("様")) return trimmed;
  return `${trimmed} 様`;
}

/** 帳票の宛先表示（会社名は常に御中、担当者は別行） */
export function formatDocumentRecipient(
  customerName: string,
  contactName?: string
): { primaryLine: string; contactLine?: string } {
  const company = customerName.trim();
  const contact = contactName?.trim();

  const primaryLine = company.endsWith("御中")
    ? company
    : `${company} 御中`;

  if (!contact) {
    return { primaryLine };
  }

  const name = contact.endsWith("様")
    ? contact.slice(0, -1).trimEnd()
    : contact;

  return {
    primaryLine,
    contactLine: `担当者：${name}様`,
  };
}
