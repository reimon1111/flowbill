const TARGET_TYPE_LABELS = {
  project: "案件",
  customer: "顧客",
  item_template: "商品マスタ",
  quote: "見積書",
  order: "注文書",
  delivery_note: "納品書",
  invoice: "請求書",
  receipt: "領収書",
  member: "メンバー",
  invitation: "招待",
} as const;

function labeled(type: keyof typeof TARGET_TYPE_LABELS, label: string): string {
  const kind = TARGET_TYPE_LABELS[type];
  return label ? `${kind}「${label}」` : kind;
}

export function activityDescriptionCreated(
  targetType: keyof typeof TARGET_TYPE_LABELS,
  targetLabel: string
): string {
  return `${labeled(targetType, targetLabel)}を作成しました`;
}

export function activityDescriptionUpdated(
  targetType: keyof typeof TARGET_TYPE_LABELS,
  targetLabel: string
): string {
  return `${labeled(targetType, targetLabel)}を更新しました`;
}

export function activityDescriptionDeleted(
  targetType: keyof typeof TARGET_TYPE_LABELS,
  targetLabel: string
): string {
  return `${labeled(targetType, targetLabel)}を削除しました`;
}

export function activityDescriptionInvoiceIssued(invoiceNumber: string): string {
  return `請求書「${invoiceNumber}」を発行しました`;
}

export function activityDescriptionInvoicePaid(invoiceNumber: string): string {
  return `請求書「${invoiceNumber}」を入金済みに変更しました`;
}

export function activityDescriptionMemberInvited(email: string): string {
  return `${email} を招待しました`;
}

export function activityDescriptionMemberRemoved(label: string): string {
  return label ? `メンバー「${label}」を削除しました` : "メンバーを削除しました";
}

export function activityDescriptionInvitationCanceled(email: string): string {
  return `${email} への招待を取り消しました`;
}
