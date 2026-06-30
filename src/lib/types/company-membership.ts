export type CompanyMemberRole = "owner" | "admin" | "member" | "viewer";

export type CompanyMemberStatus = "active" | "inactive";

export type CompanyMemberRecord = {
  id: string;
  companyId: string;
  userId: string;
  role: CompanyMemberRole;
  status: CompanyMemberStatus;
  email: string;
  joinedAt: string;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyInvitationRole = "admin" | "member" | "viewer";

export type CompanyInvitationRecord = {
  id: string;
  companyId: string;
  email: string;
  role: CompanyInvitationRole;
  token: string;
  invitedBy: string;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

/** 未ログインでも token で1件だけ取得する招待情報（RPC経由） */
export type PublicCompanyInvitationRecord = {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  role: CompanyInvitationRole;
  expiresAt: string;
  acceptedAt: string | null;
};

export type UserCompanySummary = {
  companyId: string;
  companyName: string;
  role: CompanyMemberRole;
  isCurrent: boolean;
};

export const COMPANY_MEMBER_ROLE_LABELS: Record<CompanyMemberRole, string> = {
  owner: "オーナー",
  admin: "管理者",
  member: "メンバー",
  viewer: "閲覧者",
};

export const COMPANY_INVITATION_ROLE_LABELS: Record<CompanyInvitationRole, string> = {
  admin: "管理者",
  member: "メンバー",
  viewer: "閲覧者",
};

export function canManageMembers(role: CompanyMemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin";
}

export function canWriteBusinessData(role: CompanyMemberRole | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "member";
}
