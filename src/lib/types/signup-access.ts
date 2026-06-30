export type AllowedSignupStatus = "pending" | "used" | "canceled" | "expired";

export type ContractStatus = "active" | "trial" | "suspended" | "canceled";

export type AllowedSignupRecord = {
  id: string;
  email: string;
  companyName: string;
  role: string;
  status: AllowedSignupStatus;
  token: string;
  usedAt: string | null;
  expiresAt: string | null;
  invitedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminCompanyRow = {
  id: string;
  companyName: string;
  email: string;
  contractStatus: ContractStatus;
  contractStartedAt: string | null;
  contractEndedAt: string | null;
  createdAt: string;
  memberCount: number;
};

export const SIGNUP_NOT_ALLOWED_MESSAGE =
  "このメールアドレスでは登録できません。\n管理者へお問い合わせください。";

export const CONTRACT_BLOCKED_MESSAGE =
  "この会社アカウントは現在利用できません。契約状況をご確認ください。";

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "利用中",
  trial: "トライアル",
  suspended: "停止中",
  canceled: "解約済み",
};

export function isContractUsable(status: ContractStatus): boolean {
  return status === "active" || status === "trial";
}
