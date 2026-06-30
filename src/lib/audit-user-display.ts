import type { CompanyMemberRecord } from "@/lib/types/company-membership";

/** profiles に名前列がないため、メンバー一覧の email を表示名として使う */
export function resolveAuditUserLabel(
  userId: string | null | undefined,
  members: CompanyMemberRecord[]
): string {
  if (!userId) return "—";
  const member = members.find((m) => m.userId === userId);
  const email = member?.email?.trim();
  if (email) return email;
  return "不明なユーザー";
}
