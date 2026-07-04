const PENDING_INVITE_TOKEN_KEY = "flowbill.pending_invite_token";

export function setPendingInviteToken(token: string | null | undefined): void {
  if (typeof sessionStorage === "undefined") return;
  if (token) {
    sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  }
}

export function consumePendingInviteToken(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  const token = sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY);
  sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
  return token;
}

/** /invite/{token} 形式の redirect から token を取り出す */
export function extractInviteTokenFromRedirect(redirectTo: string): string | null {
  const match = redirectTo.match(/^\/invite\/([^/?#]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}
