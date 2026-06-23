/** 注文書作成時の宛名初期値（自社名 + 御中） */
export function defaultOrderRecipientName(companyName: string): string {
  const name = companyName.trim();
  if (!name) return "";
  if (name.endsWith("御中") || name.endsWith("様")) return name;
  return `${name} 御中`;
}
